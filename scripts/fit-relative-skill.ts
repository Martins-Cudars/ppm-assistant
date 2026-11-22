/**
 * Fits the relative-skill references (the 100% lines behind "Relative skill")
 * from a backup file, for every sport: one over every scouted player
 * ("global") and one over the teams of the user's current league ("league").
 * Run it after more teams have been scouted. With --write it overwrites
 * src/sports/<sport>/relativeSkillReference.ts.
 *
 * Build and run it like the checks in test/README.md (an SSR bundle via a
 * throwaway vite config, input this file):
 *
 *   node fit.mjs path/to/ppm-assistant-backup.json [--sport hockey|soccer|basketball]
 *     [--percentile 0.95] [--compare] [--write]
 *
 * The method (docs/skill-history.md, "Relative skill"):
 * 1. OR reference. Scouted rosters, one point per player and season (his
 *    latest snapshot). Per whole age, the percentile of OR in a one-season
 *    window centred on it, each point first moved along a rough curve to that
 *    age (season-day drift). A window with too few points widens; the curve
 *    is fitted unimodal (rises to a peak, then falls), weighted by count.
 * 2. League. The league's points against the global curve: per age a ratio,
 *    shrunk toward a weighted linear trend of the ratios by its sample count,
 *    so a sparse age leans on its neighbours instead of on two players.
 * 3. OR to rating. A roster shows OR only; relative skill compares the best
 *    position's rating with XP. Players with full skills and XP (the player
 *    cache, plus history days with XP) give, per age, the best position's
 *    rating as a share of OR, and the median XP.
 * 4. The tables: skill = share x OR reference, exp = median XP.
 */

import fs from "fs";
import path from "path";
import { calculateSkillWithExp } from "@/base/calculations";
import {
  bestPositionRating as hockeyBest,
  overallFromSkills as hockeyOverall,
} from "@/sports/hockey/growthPace";
import {
  bestPositionRating as soccerBest,
  overallFromSkills as soccerOverall,
} from "@/sports/soccer/growthPace";
import { basketballOverall, bestBasketballPosition } from "@/sports/basketball/growthModel";
import { BasketballSkills } from "@/sports/basketball/classes/BasketballPlayer";
import { relativeSkillReference as hockeyCurrent } from "@/sports/hockey/relativeSkillReference";
import { relativeSkillReference as soccerCurrent } from "@/sports/soccer/relativeSkillReference";
import { relativeSkillReference as basketballCurrent } from "@/sports/basketball/relativeSkillReference";
import { RelativeSkillReference } from "@/types/GrowthData";
import { BackupFile } from "@/types/Backup";
import { GrowthPrediction } from "@/types/GrowthData";
import { ScoutSnapshot } from "@/types/ScoutSnapshot";

type Sport = "hockey" | "soccer" | "basketball";
type AnySkills = Record<string, number>;

type SportConfig = {
  /** Best position's rating without XP, and OR, from one day's skills. */
  rate: (skills: AnySkills, height: number | undefined) => { rating: number; overall: number };
  current: RelativeSkillReference;
  daysPerSeason: number;
  minAge: number;
  maxAge: number;
};

const SPORTS: Record<Sport, SportConfig> = {
  hockey: {
    rate: (skills) => ({
      rating: hockeyBest(skills as never).rating,
      overall: hockeyOverall(skills as never),
    }),
    current: hockeyCurrent,
    daysPerSeason: 112,
    minAge: 15,
    maxAge: 45,
  },
  soccer: {
    rate: (skills) => ({
      rating: soccerBest(skills as never).rating,
      overall: soccerOverall(skills as never),
    }),
    current: soccerCurrent,
    daysPerSeason: 112,
    minAge: 15,
    maxAge: 40,
  },
  basketball: {
    rate: (skills, height) => ({
      rating: bestBasketballPosition(skills as BasketballSkills, height ?? 0).rating,
      overall: basketballOverall(skills as BasketballSkills),
    }),
    current: basketballCurrent,
    daysPerSeason: 70,
    minAge: 15,
    maxAge: 40,
  },
};

/** Fewest points an age's OR window may hold before it widens. */
const MIN_OR_SAMPLES = 25;
/** Fewest skill+XP players an age's window may hold before it widens. */
const MIN_PAIR_SAMPLES = 6;
/** Widest half-window, in seasons, before an age counts as unmeasured. */
const MAX_HALF_WINDOW = 2;
/** League ratios: an age with this many points weighs as much as the trend. */
const LEAGUE_SHRINK = 25;

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const backupPath = args.find(
  (arg, i) => !arg.startsWith("--") && !(args[i - 1] ?? "").match(/^--(sport|percentile)$/)
);
if (!backupPath) {
  throw new Error(
    "Usage: fit-relative-skill <backup.json> [--sport s] [--percentile p] [--compare] [--write]"
  );
}
const percentile = Number(option("percentile", "0.95"));
const onlySport = option("sport", "");
const compare = args.includes("--compare");
const write = args.includes("--write");

const backup = JSON.parse(fs.readFileSync(backupPath, "utf8")) as BackupFile;

function quantile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.min(low + 1, sorted.length - 1);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

/** Weighted pool-adjacent-violators, non-decreasing. */
function isotonic(values: number[], weights: number[]): number[] {
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
  return blocks.flatMap((block) => Array(block.count).fill(block.value));
}

/** Weighted unimodal fit: non-decreasing to a peak, non-increasing after; the peak that fits best. */
function unimodal(values: number[], weights: number[]): number[] {
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
function movingAverage(values: number[], reach: number): number[] {
  return values.map((_, i) => {
    const near = values.slice(Math.max(0, i - reach), i + reach + 1);
    return near.reduce((sum, v) => sum + v, 0) / near.length;
  });
}

type AgedPoint = { x: number; value: number };
type Measured = { value: number; n: number; half: number } | null;

/**
 * Per whole age, `stat` over the points within a half-window that widens by
 * quarter seasons until it holds `min` points. Null when even the widest has
 * too few. `adjust` may move a point's value to the window's age first.
 */
function windowed(
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
 * the first two measured ages' slope.
 */
function fillGaps(values: (number | null)[], extendStart = false): number[] {
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
      return Math.max(0, values[first]! - slope * (first - i));
    }
    if (after == null) return values[before]!;
    const t = (i - before) / (after - before);
    return values[before]! + (values[after]! - values[before]!) * t;
  });
}

function interpolate(ages: number[], values: number[], x: number): number {
  if (x <= ages[0]) return values[0];
  if (x >= ages[ages.length - 1]) return values[values.length - 1];
  const i = Math.floor(x - ages[0]);
  return values[i] + (values[i + 1] - values[i]) * (x - ages[i]);
}

/** The 100% value at an exact age, as BasePlayer.getMaxSkillForAge() reads a table. */
function tableValueAt(table: GrowthPrediction, age: number, seasonProgress: number): number {
  const row = table.find((r) => r.age === age);
  if (!row) return 0;
  const next = table.find((r) => r.age === age + 1);
  let skill = row.skill;
  let exp = row.exp;
  if (next) {
    skill += (next.skill - row.skill) * seasonProgress;
    exp += (next.exp - row.exp) * seasonProgress;
  }
  return calculateSkillWithExp(Math.round(skill), Math.round(exp));
}

function fitSport(sport: Sport) {
  const config = SPORTS[sport];
  const ages: number[] = [];
  for (let age = config.minAge; age <= config.maxAge; age++) ages.push(age);
  const p = (values: number[]) => quantile(values, percentile);

  // 1. Global OR reference.
  const leagueTeams = new Set(backup.leagues?.[sport]?.teamIds ?? []);
  const latest = new Map<string, ScoutSnapshot>();
  for (const row of backup.scoutSnapshots?.[sport] ?? []) {
    if (row.age == null || row.overallRating == null || row.season == null) continue;
    const key = `${row.playerId}:${row.season}`;
    const seen = latest.get(key);
    if (!seen || row.date > seen.date) latest.set(key, row);
  }
  const points = [...latest.values()].map((row) => ({
    x: row.age + (row.seasonDay ?? 0) / config.daysPerSeason,
    value: row.overallRating,
    inLeague: leagueTeams.has(row.teamId),
  }));
  const leaguePoints = points.filter((point) => point.inLeague);

  // Pass 1: a rough curve from full one-season windows only (a widened window
  // is lopsided: at 15 nobody is younger, so it holds 15-16-year-olds); its
  // first ages continue the slope of the next two.
  const roughMeasured = windowed(points, ages, MIN_OR_SAMPLES, p, 0.5);
  const rough = unimodal(
    fillGaps(roughMeasured.map((m) => m?.value ?? null), true),
    roughMeasured.map((m) => (m ? m.n : 0.5))
  );
  // Pass 2: each point moved along the rough curve to the age it is counted
  // at, so a window's late-season players don't lift it.
  const toAge = (age: number, point: AgedPoint) =>
    point.value * (interpolate(ages, rough, age) / interpolate(ages, rough, point.x));
  const globalMeasured = windowed(points, ages, MIN_OR_SAMPLES, p, MAX_HALF_WINDOW, toAge);
  const globalOr = unimodal(
    fillGaps(globalMeasured.map((m) => m?.value ?? null)),
    globalMeasured.map((m) => (m ? m.n : 0.5))
  );

  // 2. League: ratios to the global curve, shrunk toward their weighted trend.
  const leagueMeasured = windowed(leaguePoints, ages, 3, p, 1, toAge);
  const ratios = leagueMeasured.map((m, i) => (m ? m.value / globalOr[i] : null));
  const trend = (() => {
    let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    ratios.forEach((r, i) => {
      if (r == null) return;
      const w = leagueMeasured[i]!.n;
      sw += w; sx += w * ages[i]; sy += w * r; sxx += w * ages[i] ** 2; sxy += w * ages[i] * r;
    });
    if (sw === 0) return () => 1;
    const slope = (sw * sxy - sx * sy) / (sw * sxx - sx * sx || 1);
    const intercept = (sy - slope * sx) / sw;
    return (age: number) => intercept + slope * age;
  })();
  const shrunk = ratios.map((r, i) => {
    const n = leagueMeasured[i]?.n ?? 0;
    return r == null ? trend(ages[i]) : (n * r + LEAGUE_SHRINK * trend(ages[i])) / (n + LEAGUE_SHRINK);
  });
  const leagueOr = unimodal(
    shrunk.map((r, i) => r * globalOr[i]),
    leagueMeasured.map((m) => (m?.n ?? 0) + LEAGUE_SHRINK)
  );

  // 3. OR to rating: players with full skills and XP.
  const cache = Object.entries(backup.playerCaches).find(([key]) => key.includes(`:${sport}:`))?.[1];
  const pairs: { x: number; share: number; exp: number; id: string }[] = [];
  const seenPair = new Set<string>();
  const addPair = (id: string, x: number, skills: AnySkills, height: number | undefined, exp: number) => {
    const key = `${id}:${Math.round(x)}`;
    if (seenPair.has(key)) return;
    const { rating, overall } = config.rate(skills, height);
    if (overall <= 0 || rating <= 0) return;
    seenPair.add(key);
    pairs.push({ x, share: rating / overall, exp, id });
  };
  // The age a cached player had on a date: his stored age is from his last update.
  const ageOn = (playerId: string, date: string): number | null => {
    const player = cache?.players[playerId];
    if (!player) return null;
    const seasonDay = player.metadata?.seasonDay ?? cache?.currentSeasonDay ?? 0;
    const updated = Date.parse(player.metadata?.updatedAt ?? backup.exportedAt);
    const daysBefore = (updated - Date.parse(`${date}T12:00:00Z`)) / 86_400_000;
    return player.baseInfo.age + (seasonDay - daysBefore) / config.daysPerSeason;
  };
  for (const player of Object.values(cache?.players ?? {})) {
    if (!player.skills || player.experience == null) continue;
    const seasonDay = player.metadata?.seasonDay ?? cache?.currentSeasonDay ?? 0;
    const height = (player.baseInfo as { height?: number }).height;
    addPair(player.baseInfo.id, player.baseInfo.age + seasonDay / config.daysPerSeason, player.skills as AnySkills, height, player.experience);
  }
  // History days with XP add the same players at earlier ages (newest first,
  // so the cache's own point keeps its age).
  const history = (sport === "hockey" ? backup.skillHistory : backup.sportSkillHistory?.[sport]) ?? [];
  [...history]
    .filter((entry) => entry.skills && entry.experience != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((entry) => {
      const age = ageOn(entry.playerId, entry.date);
      const height = (entry as { height?: number }).height;
      if (age != null) addPair(entry.playerId, age, entry.skills as AnySkills, height, entry.experience!);
    });

  const median = (values: number[]) => quantile(values, 0.5);
  const shareMeasured = windowed(pairs.map((q) => ({ x: q.x, value: q.share })), ages, MIN_PAIR_SAMPLES, median);
  const share = isotonic(
    fillGaps(shareMeasured.map((m) => m?.value ?? null)),
    shareMeasured.map((m) => (m ? m.n : 0.5))
  );
  // Medians of ~6 players step up and down: non-decreasing, then a 5-age
  // moving average so the 100% line has no jumps between ages. After the last
  // measured age XP keeps its last five ages' average yearly gain.
  const expMeasured = windowed(pairs.map((q) => ({ x: q.x, value: q.exp })), ages, MIN_PAIR_SAMPLES, median);
  const lastExp = expMeasured.map((m, i) => (m ? i : -1)).filter((i) => i >= 0).pop()!;
  const expSmooth = movingAverage(
    isotonic(
      fillGaps(expMeasured.map((m) => m?.value ?? null)).slice(0, lastExp + 1),
      expMeasured.slice(0, lastExp + 1).map((m) => (m ? m.n : 0.5))
    ),
    2
  );
  const gain = Math.max(0, (expSmooth[lastExp] - expSmooth[Math.max(0, lastExp - 5)]) / Math.min(5, lastExp || 1));
  const exp = ages.map((_, i) => (i <= lastExp ? expSmooth[i] : expSmooth[lastExp] + gain * (i - lastExp)));

  // 4. The tables.
  const table = (or: number[]): GrowthPrediction =>
    ages.map((age, i) => ({ age, skill: Math.round(share[i] * or[i]), exp: Math.round(exp[i]) }));
  const reference: RelativeSkillReference = { global: table(globalOr), league: table(leagueOr) };

  return {
    config, ages, points, leaguePoints, globalMeasured, globalOr, leagueMeasured, ratios, leagueOr,
    shareMeasured, share, expMeasured, exp, reference, pairs, cache,
  };
}

function tableSource(sport: Sport, reference: RelativeSkillReference): string {
  const rows = (table: GrowthPrediction) =>
    table.map((row) => `    { age: ${row.age}, skill: ${row.skill}, exp: ${row.exp} },`).join("\n");
  return `import { RelativeSkillReference } from "@/types/GrowthData";

/**
 * The 100% lines behind ${sport}'s relative skill: per age, the best
 * position's rating (\`skill\`) and XP (\`exp\`) of a player at the
 * ${Math.round(percentile * 100)}th percentile of scouted OR - over every scouted team (\`global\`)
 * and over the user's league (\`league\`).
 *
 * Generated by scripts/fit-relative-skill.ts from the ${backup.exportedAt.slice(0, 10)} backup.
 * Do not edit by hand: rerun the script with --write on a newer backup.
 */
export const relativeSkillReference: RelativeSkillReference = {
  global: [
${rows(reference.global)}
  ],
  league: [
${rows(reference.league)}
  ],
};
`;
}

const fmt = (value: number | null | undefined, width: number) =>
  String(value == null || Number.isNaN(value) ? "-" : Math.round(value)).padStart(width);

for (const sport of (onlySport ? [onlySport] : Object.keys(SPORTS)) as Sport[]) {
  const fit = fitSport(sport);
  const { config, ages, reference } = fit;
  const pct = `p${Math.round(percentile * 100)}`;
  console.log(
    `\n=== ${sport}: OR ${pct}, ${fit.points.length} scouted player-seasons ` +
      `(${fit.leaguePoints.length} in the league); ${fit.pairs.length} skill+XP points ` +
      `from ${new Set(fit.pairs.map((q) => q.id)).size} players`
  );
  console.log(
    "age |  n  win  raw    OR | lgN lgRaw ratio lgOR | prs share exp | global ratingXp  league ratingXp | current global"
  );
  ages.forEach((age, i) => {
    const g = fit.globalMeasured[i];
    const l = fit.leagueMeasured[i];
    const current = config.current.global.find((row) => row.age === age);
    console.log(
      `${age} | ${fmt(g?.n, 4)} ${g ? `±${g.half}`.padEnd(5) : "  -  "}${fmt(g?.value, 5)} ${fmt(fit.globalOr[i], 5)} | ` +
        `${fmt(l?.n, 3)} ${fmt(l?.value, 5)} ${(fit.ratios[i] ?? NaN).toFixed(2).padStart(5)} ${fmt(fit.leagueOr[i], 5)} | ` +
        `${fmt(fit.shareMeasured[i]?.n, 3)} ${fit.share[i].toFixed(3)} ${fmt(fit.exp[i], 3)} | ` +
        `${fmt(calculateSkillWithExp(reference.global[i].skill, reference.global[i].exp), 15)} ` +
        `${fmt(calculateSkillWithExp(reference.league[i].skill, reference.league[i].exp), 16)} | ` +
        `${fmt(current ? calculateSkillWithExp(current.skill, current.exp) : null, 14)}`
    );
  });

  if (write) {
    const file = path.resolve("src/sports", sport, "relativeSkillReference.ts");
    fs.writeFileSync(file, tableSource(sport, reference));
    console.log(`\nWrote ${file}`);
  }

  if (compare && fit.cache) {
    const cache = fit.cache;
    console.log(`\nOwn players on season day ${cache.currentSeasonDay}: current global / league -> new global / league`);
    const progress = (cache.currentSeasonDay ?? 0) / config.daysPerSeason;
    const percent = (value: number, max: number) => (max ? `${Math.round((value / max) * 100)}%` : "-").padStart(4);
    Object.values(cache.players)
      .filter((player) => player.baseInfo.teamId === cache.teamId && player.skills && player.experience != null)
      .sort((a, b) => a.baseInfo.age - b.baseInfo.age)
      .forEach((player) => {
        const height = (player.baseInfo as { height?: number }).height;
        const ratingXp = calculateSkillWithExp(config.rate(player.skills as AnySkills, height).rating, player.experience!);
        const age = player.baseInfo.age;
        console.log(
          `${player.baseInfo.name.padEnd(24)} ${String(age).padStart(2)} OR ${fmt(player.baseInfo.overallRating, 4)} ` +
            `ratingXp ${fmt(ratingXp, 4)}  ` +
            `${percent(ratingXp, tableValueAt(config.current.global, age, progress))} / ` +
            `${percent(ratingXp, tableValueAt(config.current.league, age, progress))} -> ` +
            `${percent(ratingXp, tableValueAt(reference.global, age, progress))} / ` +
            `${percent(ratingXp, tableValueAt(reference.league, age, progress))}`
        );
      });
  }
}
