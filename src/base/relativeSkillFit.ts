/**
 * Fitting the relative-skill reference (the 100% line) from scouted rosters.
 * One implementation for both users of it:
 * - scripts/fit-relative-skill.ts fits the static global line from a backup
 *   and writes src/sports/<sport>/relativeSkillReference.ts;
 * - src/base/scout/leagueRelativeSkill.ts fits the viewer's league line at
 *   runtime from his own scouted league teams, against that global line.
 *
 * The method is in docs/skill-history.md ("Relative skill"). In short: the
 * percentile of OR per whole age over one point per player and season, moved
 * to the age along a curve (season-day drift), fitted unimodal; converted to
 * rating with XP by the per-age rating/OR share and median XP of players with
 * full skills.
 */

import { GrowthPrediction } from "@/types/GrowthData";
import { ScoutSnapshot } from "@/types/ScoutSnapshot";

/** Top 5%: 100% means "as good as a top-5% scouted player of the same age". */
export const RELATIVE_SKILL_PERCENTILE = 0.95;
/** Fewest points an age's OR window may hold before it widens. */
export const MIN_OR_SAMPLES = 25;
/** Fewest skill+XP players an age's window may hold before it widens. */
export const MIN_PAIR_SAMPLES = 6;
/** Widest half-window, in seasons, before an age counts as unmeasured. */
export const MAX_HALF_WINDOW = 2;
/** League ratios: an age with this many points weighs as much as the trend. */
export const LEAGUE_SHRINK = 25;
/** Fewest points a league age needs to count as measured at all. */
export const MIN_LEAGUE_AGE_SAMPLES = 3;
/** Fewer league player-seasons or measured ages than this: no league line. */
export const MIN_LEAGUE_POINTS = 50;
export const MIN_LEAGUE_AGES = 3;

/**
 * The fitted global line of one sport, per whole age from the first row on:
 * the OR reference, the best position's rating as a share of OR, and XP.
 */
export type RelativeSkillFit = {
  percentile: number;
  rows: { age: number; or: number; share: number; exp: number }[];
};

export type AgedPoint = { x: number; value: number };
export type Measured = { value: number; n: number; half: number } | null;

export function quantile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.min(low + 1, sorted.length - 1);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

/** Weighted pool-adjacent-violators, non-decreasing. */
export function isotonic(values: number[], weights: number[]): number[] {
  const blocks: { value: number; weight: number; count: number }[] = [];
  values.forEach((value, i) => {
    blocks.push({ value, weight: weights[i], count: 1 });
    while (blocks.length > 1 && blocks[blocks.length - 2].value > blocks[blocks.length - 1].value) {
      const last = blocks.pop()!;
      const previous = blocks.pop()!;
      const weight = previous.weight + last.weight;
      blocks.push({
        value: (previous.value * previous.weight + last.value * last.weight) / weight,
        weight,
        count: previous.count + last.count,
      });
    }
  });
  return blocks.flatMap((block) => Array<number>(block.count).fill(block.value));
}

/** Weighted unimodal fit: non-decreasing to a peak, non-increasing after; the peak that fits best. */
export function unimodal(values: number[], weights: number[]): number[] {
  let best: number[] = values;
  let bestError = Infinity;
  for (let peak = 0; peak < values.length; peak++) {
    const left = isotonic(values.slice(0, peak + 1), weights.slice(0, peak + 1));
    const right = isotonic(values.slice(peak).reverse(), weights.slice(peak).reverse()).reverse();
    const fit = [...left.slice(0, peak), Math.max(left[peak], right[0]), ...right.slice(1)];
    const error = fit.reduce((sum, v, i) => sum + weights[i] * (v - values[i]) ** 2, 0);
    if (error < bestError) {
      bestError = error;
      best = fit;
    }
  }
  return best;
}

/** Each value averaged with up to `reach` neighbours either side (fewer at the ends). */
export function movingAverage(values: number[], reach: number): number[] {
  return values.map((_, i) => {
    const near = values.slice(Math.max(0, i - reach), i + reach + 1);
    return near.reduce((sum, v) => sum + v, 0) / near.length;
  });
}

/**
 * Per whole age, `stat` over the points within a half-window that widens by
 * quarter seasons until it holds `min` points. Null when even the widest has
 * too few. `adjust` may move a point's value to the window's age first.
 */
export function windowed(
  points: AgedPoint[],
  ages: number[],
  min: number,
  stat: (values: number[]) => number,
  maxHalf = MAX_HALF_WINDOW,
  adjust: (age: number, point: AgedPoint) => number = (_, point) => point.value
): Measured[] {
  return ages.map((age) => {
    for (let half = 0.5; half <= maxHalf; half += 0.25) {
      const inside = points.filter((p) => p.x >= age - half && p.x < age + half);
      if (inside.length >= min) {
        return { value: stat(inside.map((p) => adjust(age, p))), n: inside.length, half };
      }
    }
    return null;
  });
}

/**
 * Fills unmeasured ages: linear between measured ages, held flat after the
 * last; before the first either held flat or (`extendStart`) continued along
 * the first two measured ages' slope, never below `floor`.
 */
export function fillGaps(values: (number | null)[], extendStart = false, floor = 0): number[] {
  const known = values.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0);
  if (known.length === 0) throw new Error("No measured ages");
  return values.map((v, i) => {
    if (v != null) return v;
    const before = known.filter((k) => k < i).pop();
    const after = known.find((k) => k > i);
    if (before == null) {
      const [first, second] = known;
      if (!extendStart || second == null) return values[first]!;
      const slope = (values[second]! - values[first]!) / (second - first);
      return Math.max(floor, values[first]! - slope * (first - i));
    }
    if (after == null) return values[before]!;
    const t = (i - before) / (after - before);
    return values[before]! + (values[after]! - values[before]!) * t;
  });
}

/**
 * The unimodal fit leaves flat blocks with steps between them (e.g. 34-36
 * level, then a drop at 37), which a chart's spline draws as bumps. A 1-2-1
 * average of each inner age smooths the steps; it keeps a single peak, since
 * averaging with a log-concave kernel preserves unimodality. The ends stay.
 */
export function smoothSteps(values: number[]): number[] {
  return values.map((v, i) =>
    i === 0 || i === values.length - 1 ? v : (values[i - 1] + 2 * v + values[i + 1]) / 4
  );
}

/** A per-whole-age curve read at an exact age: linear between ages, flat past either end. */
export function curveAt(ages: number[], values: number[], x: number): number {
  if (x <= ages[0]) return values[0];
  if (x >= ages[ages.length - 1]) return values[values.length - 1];
  const i = Math.floor(x - ages[0]);
  return values[i] + (values[i + 1] - values[i]) * (x - ages[i]);
}

export function agesBetween(minAge: number, maxAge: number): number[] {
  const ages: number[] = [];
  for (let age = minAge; age <= maxAge; age++) ages.push(age);
  return ages;
}

/**
 * One point per player and season - his latest snapshot - at its exact age.
 * `keep` filters rows first (e.g. the league's teams).
 */
export function scoutPoints(
  rows: readonly ScoutSnapshot[],
  daysPerSeason: number,
  keep: (row: ScoutSnapshot) => boolean = () => true
): AgedPoint[] {
  const latest = new Map<string, { date: string; point: AgedPoint }>();
  for (const row of rows) {
    if (!keep(row)) continue;
    if (row.age == null || row.overallRating == null || row.season == null) continue;
    const key = `${row.playerId}:${row.season}`;
    const seen = latest.get(key);
    if (seen && seen.date >= row.date) continue;
    latest.set(key, {
      date: row.date,
      point: { x: row.age + (row.seasonDay ?? 0) / daysPerSeason, value: row.overallRating },
    });
  }
  return [...latest.values()].map((entry) => entry.point);
}

/** Moves a point's value along `curve` to `age` (season-day drift). */
function driftTo(ages: number[], curve: number[]) {
  return (age: number, point: AgedPoint) => {
    const from = curveAt(ages, curve, point.x);
    return from > 0 ? point.value * (curveAt(ages, curve, age) / from) : point.value;
  };
}

/**
 * The global OR reference. Pass 1: a rough curve from full one-season windows
 * only (a widened window is lopsided: at 15 nobody is younger), its first ages
 * continuing the next two ages' slope. Pass 2: each point moved along it to
 * the age it is counted at, windows widening where sparse; unimodal fit.
 */
export function fitGlobalOr(points: AgedPoint[], ages: number[], percentile: number) {
  const p = (values: number[]) => quantile(values, percentile);
  const roughMeasured = windowed(points, ages, MIN_OR_SAMPLES, p, 0.5);
  // Floored at 1, so moving a point along it never divides by zero.
  const rough = unimodal(
    fillGaps(roughMeasured.map((m) => m?.value ?? null), true, 1),
    roughMeasured.map((m) => (m ? m.n : 0.5))
  );
  const measured = windowed(points, ages, MIN_OR_SAMPLES, p, MAX_HALF_WINDOW, driftTo(ages, rough));
  const curve = smoothSteps(
    unimodal(fillGaps(measured.map((m) => m?.value ?? null)), measured.map((m) => (m ? m.n : 0.5)))
  );
  return { measured, curve };
}

/**
 * A league's OR reference against the global one: per age the league's
 * percentile as a ratio to the global curve, shrunk toward a weighted linear
 * trend of those ratios (an age with n points weighs n, the trend
 * LEAGUE_SHRINK), so a sparse age leans on its neighbours. The trend is held
 * within the measured ratios' range. Null when the league has too little data.
 */
export function fitLeagueOr(
  points: AgedPoint[],
  ages: number[],
  percentile: number,
  globalOr: number[]
) {
  if (points.length < MIN_LEAGUE_POINTS) return null;
  const measured = windowed(
    points,
    ages,
    MIN_LEAGUE_AGE_SAMPLES,
    (values) => quantile(values, percentile),
    1,
    driftTo(ages, globalOr)
  );
  const ratios = measured.map((m, i) => (m && globalOr[i] > 0 ? m.value / globalOr[i] : null));
  const known = ratios.flatMap((r, i) => (r == null ? [] : [{ age: ages[i], r, w: measured[i]!.n }]));
  if (known.length < MIN_LEAGUE_AGES) return null;

  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  known.forEach(({ age, r, w }) => {
    sw += w; sx += w * age; sy += w * r; sxx += w * age * age; sxy += w * age * r;
  });
  const denominator = sw * sxx - sx * sx;
  const slope = denominator ? (sw * sxy - sx * sy) / denominator : 0;
  const intercept = (sy - slope * sx) / sw;
  const low = Math.min(...known.map((k) => k.r));
  const high = Math.max(...known.map((k) => k.r));
  const trend = (age: number) => Math.min(high, Math.max(low, intercept + slope * age));

  const shrunk = ratios.map((r, i) => {
    const n = measured[i]?.n ?? 0;
    return r == null ? trend(ages[i]) : (n * r + LEAGUE_SHRINK * trend(ages[i])) / (n + LEAGUE_SHRINK);
  });
  const curve = smoothSteps(
    unimodal(
      shrunk.map((r, i) => r * globalOr[i]),
      measured.map((m) => (m?.n ?? 0) + LEAGUE_SHRINK)
    )
  );
  return { measured, ratios, curve };
}

/** A player with full skills on one day: rating/OR share and XP at his exact age. */
export type SkillPair = { x: number; share: number; exp: number };

/**
 * Per age: the median rating/OR share (non-decreasing), and the median XP,
 * non-decreasing and averaged over 5 ages; after the last measured age XP
 * keeps its last five ages' average yearly gain.
 */
export function fitShareAndExp(pairs: SkillPair[], ages: number[]) {
  const median = (values: number[]) => quantile(values, 0.5);
  const shareMeasured = windowed(pairs.map((q) => ({ x: q.x, value: q.share })), ages, MIN_PAIR_SAMPLES, median);
  const share = isotonic(
    fillGaps(shareMeasured.map((m) => m?.value ?? null)),
    shareMeasured.map((m) => (m ? m.n : 0.5))
  );
  const expMeasured = windowed(pairs.map((q) => ({ x: q.x, value: q.exp })), ages, MIN_PAIR_SAMPLES, median);
  const lastExp = expMeasured.map((m, i) => (m ? i : -1)).filter((i) => i >= 0).pop();
  if (lastExp == null) throw new Error("No measured XP");
  const smooth = movingAverage(
    isotonic(
      fillGaps(expMeasured.map((m) => m?.value ?? null)).slice(0, lastExp + 1),
      expMeasured.slice(0, lastExp + 1).map((m) => (m ? m.n : 0.5))
    ),
    2
  );
  const span = Math.min(5, lastExp);
  const gain = span > 0 ? Math.max(0, (smooth[lastExp] - smooth[lastExp - span]) / span) : 0;
  const exp = ages.map((_, i) => (i <= lastExp ? smooth[i] : smooth[lastExp] + gain * (i - lastExp)));
  return { shareMeasured, share, expMeasured, exp };
}

/**
 * The reference XP curve: a user-set shape, not fitted. Roster pages show no
 * XP, and the ~6 mostly-own players per age with XP sit well below the elite
 * players the OR line describes (median ~100 at 28; elite players have ~200).
 *
 * - Fixed point: exactly 0 XP at `startAge` (15), when a player arrives from
 *   the youth facilities or the draft.
 * - From `startAge` the per-season gain rises linearly to the full rate
 *   at `rampUntil`: juniors play fewer matches. XP is quadratic there.
 * - From `rampUntil` to `anchorAge` a constant full rate, chosen so that XP at
 *   `anchorAge` is `expAtAnchor`. The two parts join without a kink.
 * - After `anchorAge` `lateRate` x the full rate: scouted veterans with XP
 *   (hockey 299 at 34, 362-368 at 39-40, 394 at 42) sit on about 0.85 x.
 */
export type XpCurveOptions = {
  startAge: number;
  rampUntil: number;
  anchorAge: number;
  expAtAnchor: number;
  lateRate: number;
};

export const DEFAULT_XP_CURVE: XpCurveOptions = {
  startAge: 15,
  rampUntil: 20,
  anchorAge: 28,
  expAtAnchor: 200,
  lateRate: 0.85,
};

export function xpCurve(ages: number[], options: XpCurveOptions = DEFAULT_XP_CURVE): number[] {
  const { startAge, rampUntil, anchorAge, expAtAnchor, lateRate } = options;
  const ramp = rampUntil - startAge;
  const rate = expAtAnchor / (ramp / 2 + (anchorAge - rampUntil));
  return ages.map((age) => {
    if (age <= startAge) return 0;
    if (age < rampUntil) return (rate * (age - startAge) ** 2) / (2 * ramp);
    if (age <= anchorAge) return (rate * ramp) / 2 + rate * (age - rampUntil);
    return expAtAnchor + lateRate * rate * (age - anchorAge);
  });
}

/** The table getMaxSkillForAge reads: skill = share x OR, exp. */
export function referenceTable(fit: RelativeSkillFit, or: number[] = fit.rows.map((row) => row.or)): GrowthPrediction {
  return fit.rows.map((row, i) => ({
    age: row.age,
    skill: Math.round(row.share * or[i]),
    exp: Math.round(row.exp),
  }));
}
