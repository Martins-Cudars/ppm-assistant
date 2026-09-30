/**
 * Basketball growth: pace, the @25 projection and potential, measured against
 * an ADAPTIVE reference - the best player in the user's own squad history at
 * each age counts as 100%. Basketball has no top-player table like hockey's,
 * and the squad's own best is measured under the same facilities and coaches,
 * so the comparison stays fair as those change.
 *
 * Why it differs from hockey (docs/skill-history.md, "Research findings"):
 *
 * - Basketball trains exactly ONE skill a day, chosen by the manager's
 *   schedule (0 of 10,158 days moved two skills). So pace is simply skill
 *   points per normal day - there's no position split to model.
 * - The reference curve IS the age effect (the best 18-year-old gains more
 *   per day than the best 26-year-old), so there are no separate age factors.
 * - Height grows 4-14 cm a season and stops at 18-22. The rating's height
 *   modifier depends on it, so projections grow it too.
 *
 * Pure functions only - no DOM, no chrome API.
 */

import { BasketballSkills } from "@/sports/basketball/classes/BasketballPlayer";
import { calculateBasketballPositions } from "@/sports/basketball/calculations/playerCalculations";
import { positionSettings } from "@/sports/basketball/settings";
import { basketballPlayerProfile } from "@/sports/basketball/playerProfile";
import { calculateSkillWithExp } from "@/base/calculations";
import { SkilledEntry, cleanedGains, daysBetween } from "@/base/gainCleaning";

type Skill = keyof BasketballSkills;

export const BASKETBALL_SKILLS: readonly Skill[] = [
  "shooting",
  "blocking",
  "passing",
  "technical",
  "speed",
  "aggression",
  "jumping",
];

/**
 * The skills the position ratings are made of. Every position rates the same
 * five (with different weights, summing to 3.0); shooting and blocking only
 * feed the game engine's bonuses.
 */
export const RATED_SKILLS: readonly Skill[] = Object.keys(positionSettings[0].ratios) as Skill[];

const DAYS_PER_SEASON = basketballPlayerProfile.daysPerSeason;

/** One skill a day, so camp days are judged per skill - see CleaningOptions. */
const CLEANING = { perSkillCampBaseline: true };

/** Same window rules as hockey's pace: 56 days back from the latest entry, full at 28. */
export const PACE_WINDOW_DAYS = 56;
export const PACE_MIN_SPAN_DAYS = 28;

/**
 * Provisional from a week, where hockey needs two. Basketball's daily gains
 * are very steady - the same skill in the same month varies by ~3% - so a week
 * already says a lot. It stays marked provisional until PACE_MIN_SPAN_DAYS.
 */
export const PACE_PROVISIONAL_MIN_DAYS = 7;

/**
 * Camp allowance for projections. The game's rule (from the user) is 5 x 2 =
 * 10 camp days a season, and the history agrees: one 10-day high-gain window
 * every ~70 days, i.e. once per 70-day season. A camp day gains 2.0x a normal
 * day. Players were sent up to age 24 (a handful of days at 25).
 */
export const CAMP_MAX_DAYS_PER_SEASON = 10;
export const CAMP_DAY_EXTRA = 1.0;
export const CAMP_UNTIL_AGE = 25;
/**
 * A season plus two weeks: with exactly 70 days, a player halfway through
 * this season's camp would miss last season's full window and read 5. Two
 * windows can then both fall inside, which the 10-day cap absorbs.
 */
export const CAMP_LOOKBACK_DAYS = 84;

/**
 * Height grows from 15 at a steady per-player rate (2.6-8.6 cm a season) and
 * stops at 17.9-19.8 - most players around 19. Projections extend a
 * still-growing player's rate to this age.
 */
export const HEIGHT_STOP_AGE = 19;

/** The fewest normal days a player needs at an age to set the reference there. */
export const REFERENCE_MIN_DAYS = 28;

/** Ages the reference covers. Past 34 players decline; projections stop there. */
export const REFERENCE_FIRST_AGE = 15;
export const REFERENCE_LAST_AGE = 34;

/**
 * Fallback reference, in skill points per normal (camp-free) day: the best
 * squad player at each age, smoothed, from the Sep 2026 backup (20 players,
 * 10,178 days, 70-day seasons). 28+ rests on one player, so the drop
 * from 27 is uncertain. Used for ages the user's own history doesn't cover yet,
 * scaled to meet the measured curve - so a new user, or an age nobody on the
 * squad has reached, still gets a sensible shape.
 */
export const DEFAULT_REFERENCE: Readonly<Record<number, number>> = {
  15: 1.25,
  16: 1.15,
  17: 1.13,
  18: 1.13,
  19: 1.03,
  20: 1.03,
  21: 0.96,
  22: 0.91,
  23: 0.91,
  24: 0.91,
  25: 0.76,
  26: 0.65,
  27: 0.6,
  28: 0.23,
  29: 0.17,
  30: 0.13,
  31: 0.07,
  32: 0.03,
  33: 0,
  34: 0,
};

export interface ReferencePoint {
  age: number;
  /** Skill points per normal day that count as 100% at this age. */
  perDay: number;
  /** "squad": measured from the user's history; "default": filled in from DEFAULT_REFERENCE. */
  source: "squad" | "default";
  /** The best player at this age, before smoothing. Only for measured ages. */
  bestPlayerId?: string;
  bestPerDay?: number;
  /** How many players had enough days at this age. */
  players?: number;
}

export type ReferenceCurve = ReferencePoint[];

type HistoryEntry = {
  playerId: string;
  date: string;
  skills?: BasketballSkills;
  height?: number;
};

type Skilled = SkilledEntry<Skill> & HistoryEntry & { skills: BasketballSkills };

const hasSkills = (entry: HistoryEntry): entry is Skilled => !!entry.skills;

/** Age on an entry's date, counting a season as daysPerSeason (70) calendar days. */
export function entryAge(date: string, currentExactAge: number, today: number = Date.now()): number {
  const daysAgo = (today - Date.parse(`${date}T00:00:00`)) / 86_400_000;
  return currentExactAge - daysAgo / DAYS_PER_SEASON;
}

/**
 * Builds the reference from every player's history: at each age, the best
 * player's skill points per normal day (no-training and camp days skipped,
 * only players with REFERENCE_MIN_DAYS measured day by day).
 *
 * The raw best is jagged - a different player is best at each age, so 24 can
 * read higher than 23. After the peak the curve is made non-increasing
 * (pool-adjacent-violators: a rise is averaged with the ages before it), so a
 * projection never speeds up with age just because of who happened to be on
 * the squad. Ages without enough data come from DEFAULT_REFERENCE, scaled by
 * the nearest measured age's ratio to it.
 */
export function buildReferenceCurve(
  historyByPlayer: Map<string, HistoryEntry[]>,
  exactAgeByPlayer: Map<string, number>,
  today: number = Date.now()
): ReferenceCurve {
  const best = new Map<number, { perDay: number; playerId: string; players: number }>();

  historyByPlayer.forEach((entries, playerId) => {
    const exactAge = exactAgeByPlayer.get(playerId);
    if (exactAge === undefined) return;

    const byAge = new Map<number, Skilled[]>();
    entries
      .filter(hasSkills)
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((entry) => {
        const age = Math.floor(entryAge(entry.date, exactAge, today));
        const list = byAge.get(age);
        if (list) list.push(entry);
        else byAge.set(age, [entry]);
      });

    byAge.forEach((segment, age) => {
      if (segment.length < 2) return;
      const span = daysBetween(segment[0].date, segment[segment.length - 1].date);
      const cleaned = cleanedGains(segment, BASKETBALL_SKILLS, span, CLEANING);
      // Mostly day-by-day data only: a pair of profile visits months apart
      // can't be cleaned of camps and would let another team's player set
      // the bar. A missed day here and there is fine.
      if (cleaned.measuredDailyDays < REFERENCE_MIN_DAYS) return;
      if (cleaned.measuredDailyDays < 0.8 * cleaned.measuredDays) return;
      const total = BASKETBALL_SKILLS.reduce((sum, skill) => sum + cleaned.gains[skill], 0);
      const perDay = total / cleaned.measuredDays;
      const current = best.get(age);
      if (!current) best.set(age, { perDay, playerId, players: 1 });
      else {
        current.players++;
        if (perDay > current.perDay) {
          current.perDay = perDay;
          current.playerId = playerId;
        }
      }
    });
  });

  const measuredAges = [...best.keys()]
    .filter((age) => age >= REFERENCE_FIRST_AGE && age <= REFERENCE_LAST_AGE)
    .sort((a, b) => a - b);

  // Non-increasing from the peak on (PAVA over the measured ages).
  const smoothed = new Map<number, number>();
  measuredAges.forEach((age) => smoothed.set(age, best.get(age)!.perDay));
  if (measuredAges.length > 0) {
    const peakAge = measuredAges.reduce((peak, age) =>
      best.get(age)!.perDay > best.get(peak)!.perDay ? age : peak
    );
    const tail = measuredAges.filter((age) => age >= peakAge);
    const blocks: { ages: number[]; value: number }[] = [];
    tail.forEach((age) => {
      blocks.push({ ages: [age], value: best.get(age)!.perDay });
      while (blocks.length > 1 && blocks[blocks.length - 1].value > blocks[blocks.length - 2].value) {
        const last = blocks.pop()!;
        const previous = blocks.pop()!;
        const ages = [...previous.ages, ...last.ages];
        blocks.push({
          ages,
          value:
            (previous.value * previous.ages.length + last.value * last.ages.length) / ages.length,
        });
      }
    });
    blocks.forEach((block) => block.ages.forEach((age) => smoothed.set(age, block.value)));
  }

  const curve: ReferenceCurve = [];
  for (let age = REFERENCE_FIRST_AGE; age <= REFERENCE_LAST_AGE; age++) {
    const measured = smoothed.get(age);
    if (measured !== undefined) {
      const raw = best.get(age)!;
      curve.push({
        age,
        perDay: measured,
        source: "squad",
        bestPlayerId: raw.playerId,
        bestPerDay: raw.perDay,
        players: raw.players,
      });
      continue;
    }
    // Scale the default by the nearest measured age's ratio to it, so the
    // filled-in part meets the measured part instead of jumping.
    const nearest = measuredAges.reduce<number | null>(
      (found, candidate) =>
        found === null || Math.abs(candidate - age) < Math.abs(found - age) ? candidate : found,
      null
    );
    const scale =
      nearest !== null && DEFAULT_REFERENCE[nearest] > 0
        ? smoothed.get(nearest)! / DEFAULT_REFERENCE[nearest]
        : 1;
    curve.push({ age, perDay: (DEFAULT_REFERENCE[age] ?? 0) * scale, source: "default" });
  }
  return curve;
}

/** The reference's points per normal day at an exact age (constant within each year). */
export function referencePerDay(curve: ReferenceCurve, age: number): number | null {
  const point = curve.find((p) => p.age === Math.floor(age));
  return point ? point.perDay : null;
}

export interface BasketballPace {
  /** Skill points per normal (camp-free, training) day. */
  pointsPerDay: number;
  pointsPerSeason: number;
  /** Share of the points each skill got - the manager's training schedule. */
  skillShares: Record<Skill, number>;
  /** The reference's points per day at the window's midpoint age, or null past the curve. */
  referencePerDay: number | null;
  /** pointsPerDay / referencePerDay: 1.0 = trains like the squad's best at that age. */
  pace: number | null;
  midAge: number;
  fromDate: string;
  toDate: string;
  spanDays: number;
  measuredDays: number;
  skippedNoTrainingDays: number;
  skippedCampDays: number;
  provisional: boolean;
  campDaysPerSeason: number;
  campDaysAssumed: boolean;
  /** Height growth in cm per season, 0 once it has stopped. */
  heightPerSeason: number;
}

/**
 * The player's recent pace, or null without enough history. The window ends
 * at the player's latest entry with skills, as in hockey.
 */
export function measureBasketballPace(
  entries: HistoryEntry[],
  currentExactAge: number,
  curve: ReferenceCurve,
  today: number = Date.now()
): BasketballPace | null {
  const usable = entries.filter(hasSkills).sort((a, b) => a.date.localeCompare(b.date));
  if (usable.length < 2) return null;

  const last = usable[usable.length - 1];
  const first = usable.find((entry) => daysBetween(entry.date, last.date) <= PACE_WINDOW_DAYS);
  if (!first || first === last) return null;

  const window = usable.slice(usable.indexOf(first));
  const spanDays = daysBetween(first.date, last.date);
  const cleaned = cleanedGains(window, BASKETBALL_SKILLS, spanDays, CLEANING);
  if (cleaned.measuredDays < PACE_PROVISIONAL_MIN_DAYS) return null;

  const total = BASKETBALL_SKILLS.reduce((sum, skill) => sum + cleaned.gains[skill], 0);
  const pointsPerDay = total / cleaned.measuredDays;
  const skillShares = Object.fromEntries(
    BASKETBALL_SKILLS.map((skill) => [
      skill,
      total > 0 ? Math.max(0, cleaned.gains[skill]) / total : 0,
    ])
  ) as Record<Skill, number>;

  // Camps come every ~70 days, so a full season is read, not just the window.
  const seasonStart = usable.find(
    (entry) => daysBetween(entry.date, last.date) <= CAMP_LOOKBACK_DAYS
  )!;
  const campDaysAssumed = daysBetween(usable[0].date, last.date) < CAMP_LOOKBACK_DAYS;
  const campDaysPerSeason = campDaysAssumed
    ? CAMP_MAX_DAYS_PER_SEASON
    : Math.min(
        CAMP_MAX_DAYS_PER_SEASON,
        cleanedGains(
          usable.slice(usable.indexOf(seasonStart)),
          BASKETBALL_SKILLS,
          daysBetween(seasonStart.date, last.date),
          CLEANING
        ).skippedCampDays
      );

  const midAge =
    (entryAge(first.date, currentExactAge, today) + entryAge(last.date, currentExactAge, today)) / 2;
  const reference = referencePerDay(curve, midAge);

  return {
    pointsPerDay,
    pointsPerSeason: pointsPerDay * DAYS_PER_SEASON,
    skillShares,
    referencePerDay: reference,
    pace: reference && reference > 0 ? pointsPerDay / reference : null,
    midAge,
    fromDate: first.date,
    toDate: last.date,
    spanDays,
    measuredDays: cleaned.measuredDays,
    skippedNoTrainingDays: cleaned.skippedNoTrainingDays,
    skippedCampDays: cleaned.skippedCampDays,
    provisional: cleaned.measuredDays < PACE_MIN_SPAN_DAYS,
    campDaysPerSeason,
    campDaysAssumed,
    heightPerSeason: measureHeightGrowth(usable),
  };
}

/**
 * cm per season over the last season, or 0 if the player hasn't grown in the
 * pace window - growth is steady until it stops, so a quiet window means done.
 */
function measureHeightGrowth(usable: Skilled[]): number {
  const withHeight = usable.filter((entry) => typeof entry.height === "number" && entry.height > 0);
  if (withHeight.length < 2) return 0;
  const last = withHeight[withHeight.length - 1];
  const windowStart = withHeight.find((e) => daysBetween(e.date, last.date) <= PACE_WINDOW_DAYS)!;
  if (windowStart.height === last.height) return 0;
  const seasonStart = withHeight.find((e) => daysBetween(e.date, last.date) <= CAMP_LOOKBACK_DAYS)!;
  const span = daysBetween(seasonStart.date, last.date);
  return span > 0 ? ((last.height! - seasonStart.height!) / span) * DAYS_PER_SEASON : 0;
}

/**
 * Reference points between two ages at a pace, with the camp allowance: each
 * camp day before CAMP_UNTIL_AGE adds CAMP_DAY_EXTRA of a normal day. The
 * reference is camp-free, so camps have to be added back here.
 */
export function referencePointsBetween(
  curve: ReferenceCurve,
  fromAge: number,
  toAge: number,
  campDaysPerSeason: number
): number {
  const endAge = Math.min(toAge, REFERENCE_LAST_AGE + 1);
  const campBoost = 1 + (campDaysPerSeason * CAMP_DAY_EXTRA) / DAYS_PER_SEASON;
  let total = 0;
  let age = fromAge;
  while (age < endAge) {
    const segmentEnd = Math.min(Math.floor(age) + 1, endAge);
    const perDay = referencePerDay(curve, age) ?? 0;
    const camps = age < CAMP_UNTIL_AGE ? campBoost : 1;
    total += perDay * DAYS_PER_SEASON * camps * (segmentEnd - age);
    age = segmentEnd;
  }
  return total;
}

/**
 * The highest rating `points` skill points can buy for a position when spent
 * on the rated skills where they raise the rating most - the bottleneck first,
 * then all five at their weights. Solves sum(max(0, R * ratio - skill)) = points.
 */
export function solveBalancedBasketballRating(
  skills: BasketballSkills,
  positionName: string,
  points: number
): number | null {
  const position = positionSettings.find((p) => p.name === positionName);
  if (!position) return null;
  const weights = Object.entries(position.ratios) as [Skill, number][];

  const cost = (rating: number) =>
    weights.reduce((sum, [skill, ratio]) => sum + Math.max(0, rating * ratio - skills[skill]), 0);

  const ratioSum = weights.reduce((sum, [, ratio]) => sum + ratio, 0);
  const skillSum = weights.reduce((sum, [skill]) => sum + skills[skill], 0);
  let low = Math.min(...weights.map(([skill, ratio]) => skills[skill] / ratio));
  let high = Math.max(
    ...weights.map(([skill, ratio]) => skills[skill] / ratio),
    (Math.max(0, points) + skillSum) / ratioSum
  );
  for (let i = 0; i < 60; i++) {
    const middle = (low + high) / 2;
    if (cost(middle) <= points) low = middle;
    else high = middle;
  }
  return Math.round(low * 1e6) / 1e6;
}

/** Best position for skills and height, rating without XP. */
export function bestBasketballPosition(
  skills: BasketballSkills,
  height: number
): { name: string; rating: number } {
  return calculateBasketballPositions(skills, height, 0, positionSettings).reduce(
    (found, position) =>
      position.ratingWithBonus > found.rating
        ? { name: position.name, rating: position.ratingWithBonus }
        : found,
    { name: "?", rating: -Infinity }
  );
}

/** Overall rating: the sum of the seven skills, each rounded down (exact on 10,178 days). */
export function basketballOverall(skills: BasketballSkills): number {
  return BASKETBALL_SKILLS.reduce((sum, skill) => sum + Math.floor(skills[skill] ?? 0), 0);
}

export interface BasketballProjection {
  skills: BasketballSkills;
  height: number;
  /** Best position at the target age - it can change as the player grows. */
  position: string;
  /** That position's rating, no XP. */
  rating: number;
  overall: number;
  /** Skill points added between now and the target age. */
  points: number;
}

/**
 * Where the player lands at `targetAge` if they keep training at the same
 * fraction of the reference:
 *
 * - Points = pace x the reference's points from now to the target, camps included.
 * - Shooting and blocking get their current share of those points (the
 *   manager's schedule); the rest goes into the five rated skills, spent
 *   balanced for each position in turn. The best resulting position wins, so
 *   a growing 16-year-old can project into a different position.
 * - Height keeps its observed rate until HEIGHT_STOP_AGE.
 *
 * Null without a pace, or at or past the target.
 */
export function projectBasketball(
  skills: BasketballSkills | undefined,
  height: number,
  currentExactAge: number,
  pace: BasketballPace | null,
  curve: ReferenceCurve,
  targetAge: number
): BasketballProjection | null {
  if (!skills || !pace || pace.pace === null) return null;
  if (currentExactAge >= targetAge) return null;

  const points =
    Math.max(0, pace.pace) *
    referencePointsBetween(curve, currentExactAge, targetAge, pace.campDaysPerSeason);

  const ratedShare = RATED_SKILLS.reduce((sum, skill) => sum + pace.skillShares[skill], 0);
  const ratedPoints = points * ratedShare;

  const growthUntil = Math.min(targetAge, HEIGHT_STOP_AGE);
  const projectedHeight =
    currentExactAge < growthUntil
      ? Math.floor(height + pace.heightPerSeason * (growthUntil - currentExactAge))
      : height;

  let best: BasketballProjection | null = null;
  for (const position of positionSettings) {
    const rating = solveBalancedBasketballRating(skills, position.name, ratedPoints);
    if (rating === null) continue;
    const projected = { ...skills };
    (Object.entries(position.ratios) as [Skill, number][]).forEach(([skill, ratio]) => {
      projected[skill] = Math.max(skills[skill], rating * ratio);
    });
    projected.shooting = skills.shooting + points * pace.skillShares.shooting;
    projected.blocking = skills.blocking + points * pace.skillShares.blocking;

    const withHeight = calculateBasketballPositions(projected, projectedHeight, 0, positionSettings).find(
      (p) => p.name === position.name
    )!;
    if (!best || withHeight.ratingWithBonus > best.rating) {
      best = {
        skills: projected,
        height: projectedHeight,
        position: position.name,
        rating: withHeight.ratingWithBonus,
        overall: basketballOverall(projected),
        points,
      };
    }
  }
  return best;
}

/** The age potential projects to - where skill with XP roughly peaks, as in hockey. */
export const POTENTIAL_AGE = 32;

/**
 * Typical XP gained per (70-day) season at each age on the user's squad, read
 * off the Sep 2026 cache: about 2 at 17, 10 at 19, 17 at 21, 30 at 23, 38-47
 * at 25, 55-67 at 26-28 and 96 at 35. XP isn't in the daily history, so this
 * rests on one snapshot; the player's own share of it is used when higher.
 */
export const TYPICAL_XP_PER_SEASON: readonly { fromAge: number; xp: number }[] = [
  { fromAge: 15, xp: 1 },
  { fromAge: 17, xp: 4 },
  { fromAge: 21, xp: 7 },
  { fromAge: 23, xp: 8 },
  { fromAge: 28, xp: 4.5 },
];

const xpPerSeasonAt = (age: number) =>
  [...TYPICAL_XP_PER_SEASON].reverse().find((band) => age >= band.fromAge)?.xp ?? 0;

/** Typical XP accumulated from 15 to an exact age. */
export function typicalXpAt(age: number): number {
  let xp = 0;
  let at = REFERENCE_FIRST_AGE;
  while (at < age) {
    const end = Math.min(Math.floor(at) + 1, age);
    xp += xpPerSeasonAt(at) * (end - at);
    at = end;
  }
  return xp;
}

/**
 * XP at `targetAge`: typical gains at the player's own share, never below
 * typical. The own share only counts once typical XP is XP_SHARE_FROM or more:
 * a 16-year-old's 4 XP against a typical 1.9 would otherwise read as 2.1x and
 * double every future season.
 */
export const XP_SHARE_FROM = 10;
export function projectBasketballXp(experience: number, currentExactAge: number, targetAge: number): number {
  const typicalNow = typicalXpAt(currentExactAge);
  const share = typicalNow >= XP_SHARE_FROM ? Math.max(1, experience / typicalNow) : 1;
  return experience + (typicalXpAt(targetAge) - typicalNow) * share;
}

export interface BasketballPotential {
  rating: number;
  xp: number;
  ratingWithXp: number;
  position: string;
  kind: "projected" | "current";
}

/**
 * Projected peak: best-position rating with XP at POTENTIAL_AGE. Players at
 * or past it show where they are now.
 */
export function projectBasketballPotential(
  skills: BasketballSkills | undefined,
  height: number,
  experience: number | undefined,
  currentExactAge: number,
  pace: BasketballPace | null,
  curve: ReferenceCurve,
  current: { rating: number; ratingWithXp: number; position: string }
): BasketballPotential | null {
  if (currentExactAge >= POTENTIAL_AGE) {
    return { ...current, xp: experience ?? 0, kind: "current" };
  }
  if (experience === undefined) return null;
  const projection = projectBasketball(skills, height, currentExactAge, pace, curve, POTENTIAL_AGE);
  if (!projection) return null;
  const xp = projectBasketballXp(experience, currentExactAge, POTENTIAL_AGE);
  return {
    rating: projection.rating,
    xp,
    ratingWithXp: calculateSkillWithExp(projection.rating, xp),
    position: projection.position,
    kind: "projected",
  };
}

/** The ISO date on which the player was (or will be) `targetAge`. */
export function basketballDateAtAge(currentExactAge: number, targetAge: number, today: number = Date.now()): string {
  const daysAgo = (currentExactAge - targetAge) * DAYS_PER_SEASON;
  return new Date(today - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

/** The entry with skills closest to `isoDate`, within `maxDays` either side. */
export function basketballEntryNear<T extends HistoryEntry>(
  entries: T[],
  isoDate: string,
  maxDays: number
): (T & { skills: BasketballSkills }) | null {
  let found: (T & { skills: BasketballSkills }) | null = null;
  let distance = Infinity;
  for (const entry of entries) {
    if (!entry.skills) continue;
    const d = Math.abs(daysBetween(isoDate, entry.date));
    if (d <= maxDays && d < distance) {
      found = entry as T & { skills: BasketballSkills };
      distance = d;
    }
  }
  return found;
}
