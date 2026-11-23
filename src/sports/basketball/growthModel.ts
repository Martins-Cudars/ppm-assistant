/**
 * Basketball growth: pace, the @25 projection and potential, measured against
 * the top-5% line (src/sports/basketball/relativeSkillReference.ts), as in
 * hockey and soccer: the line's rating gain per season, smoothed
 * (smoothedSeasonGains), is 100%. Until 2026-11-23 it was the best player in
 * the user's own squad history at each age; that read 182-224% for two
 * 28-year-olds, where one former player and a default tail set the bar
 * (docs/skill-history.md, "Basketball Pace on the top-5% line").
 *
 * How it differs from hockey (docs/skill-history.md, "Research findings"):
 *
 * - Basketball trains exactly ONE skill a day, chosen by the manager's
 *   schedule (0 of 10,158 days moved two skills). Pace counts the points that
 *   went into the five rated skills: every position weighs them summing to 3,
 *   so a balanced rating point costs 3 of them. Shooting and blocking feed
 *   only the game engine's bonuses, not the rating.
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
import { daysBetween, measureSkilledWindow } from "@/base/gainCleaning";
import { createOrModel } from "@/base/orGrowth";
import { smoothedOrSeasonGains, smoothedSeasonGains } from "@/base/relativeSkillFit";
import { relativeOrReference, relativeSkillReference } from "@/sports/basketball/relativeSkillReference";

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

/** The pace window, its minimum and the camp record, shared by the skill and OR paces. */
const SKILLED_WINDOW = {
  windowDays: PACE_WINDOW_DAYS,
  provisionalMinDays: PACE_PROVISIONAL_MIN_DAYS,
  camps: { maxDaysPerSeason: CAMP_MAX_DAYS_PER_SEASON, lookbackDays: CAMP_LOOKBACK_DAYS },
  cleaning: CLEANING,
};

/**
 * Height grows from 15 at a steady per-player rate (2.6-8.6 cm a season) and
 * stops at 17.9-19.8 - most players around 19. Projections extend a
 * still-growing player's rate to this age.
 */
export const HEIGHT_STOP_AGE = 19;

/** Ages the reference covers. Past 34 the line declines; projections stop there. */
export const REFERENCE_FIRST_AGE = 15;
export const REFERENCE_LAST_AGE = 34;

/** Every position's rated-skill weights sum to 3: a balanced rating point costs 3 skill points. */
export const RATED_WEIGHT_SUM = 3;

/**
 * The 100% rate: the top-5% line's rating gain (no XP) per 70-day season,
 * smoothed - fitted unimodal, then 1-2-1 averaged, as hockey's and soccer's
 * (src/base/relativeSkillFit.ts). On the 2026-11-22 line: 15:34 16:38 17:36
 * 18:31 20:28 22-24:27.5 26:25 27:20.5 28:13.4 29:7.3 30:4.3 32:3.1 34:0.8.
 */
export const SMOOTHED_SEASON_GAINS = smoothedSeasonGains(relativeSkillReference);

/**
 * How fast players train at each age relative to ages up to 21, at the
 * user's team, against that rate. Measured 2026-11-23 with
 * scripts/measure-age-factors.ts SPORT=basketball ERA_START=2000-01-01 on the
 * 2026-11-22 backup (all history: no facility change is known; since
 * 2025-12-01 the bands hold 19 / 9 / 5 / 1 players and read 1.00 / 0.94 /
 * 0.79 / 0.37), median pace 50% at <=21:
 *
 *   <=21   1.00   23 players, the reference
 *   22-24  1.00   11 players
 *   25-27  0.84    7 players
 *   28+    0.84   carried from 25-27: 3 players (measured 0.68) are too few,
 *                 so after 27 only the line's smoothed rate slows further
 *                 (20.5 a season at 27, 13.4 at 28, 7.3 at 29). The user's
 *                 rule: where the data is too thin, the smoothed rate.
 */
export const AGE_PACE_FACTORS: readonly { fromAge: number; factor: number }[] = [
  { fromAge: 0, factor: 1.0 },
  { fromAge: 22, factor: 1.0 },
  { fromAge: 25, factor: 0.84 },
  { fromAge: 28, factor: 0.84 },
];

const factorIn = (bands: readonly { fromAge: number; factor: number }[], age: number) =>
  [...bands].reverse().find((band) => age >= band.fromAge)?.factor ?? 1;

/** The skill pace's age factor at an exact age. */
export const agePaceFactor = (age: number) => factorIn(AGE_PACE_FACTORS, age);

export interface ReferencePoint {
  age: number;
  /** Rated-skill points per normal (camp-free) day that count as 100% at this age. */
  perDay: number;
  /** The rating gain per season behind it: the smoothed top-5% rate. */
  ratingPerSeason: number;
}

export type ReferenceCurve = ReferencePoint[];

/**
 * A reference curve from rating gains per season: per whole age from 15 to
 * 34, the rated points a day a balanced player needs to gain them
 * (gain x RATED_WEIGHT_SUM / 70). A gain at or below 0 reads 0: no pace there.
 */
export function referenceCurveFromGains(gains: Readonly<Record<number, number>>): ReferenceCurve {
  const curve: ReferenceCurve = [];
  for (let age = REFERENCE_FIRST_AGE; age <= REFERENCE_LAST_AGE; age++) {
    const ratingPerSeason = Math.max(0, gains[age] ?? 0);
    curve.push({ age, perDay: (ratingPerSeason * RATED_WEIGHT_SUM) / DAYS_PER_SEASON, ratingPerSeason });
  }
  return curve;
}

/** The top-5% line as the pace reference: what the report, the chart and the checks read. */
export const BASKETBALL_REFERENCE_CURVE = referenceCurveFromGains(SMOOTHED_SEASON_GAINS);

type HistoryEntry = {
  playerId: string;
  date: string;
  skills?: BasketballSkills;
  height?: number;
};

type Skilled = HistoryEntry & { skills: BasketballSkills };

/** Age on an entry's date, counting a season as daysPerSeason (70) calendar days. */
export function entryAge(date: string, currentExactAge: number, today: number = Date.now()): number {
  const daysAgo = (today - Date.parse(`${date}T00:00:00`)) / 86_400_000;
  return currentExactAge - daysAgo / DAYS_PER_SEASON;
}

/** The reference's points per normal day at an exact age (constant within each year). */
export function referencePerDay(curve: ReferenceCurve, age: number): number | null {
  const point = curve.find((p) => p.age === Math.floor(age));
  return point ? point.perDay : null;
}

export interface BasketballPace {
  /** Skill points per normal (camp-free, training) day, all seven skills. */
  pointsPerDay: number;
  pointsPerSeason: number;
  /** The part of pointsPerDay that went into the five rated skills - what pace counts. */
  ratedPointsPerDay: number;
  /** Share of the points each skill got - the manager's training schedule. */
  skillShares: Record<Skill, number>;
  /** The reference's rated points per day at the window's midpoint age, or null past the curve. */
  referencePerDay: number | null;
  /** ratedPointsPerDay / referencePerDay: 1.0 = the top-5% line's rating growth at that age. */
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
  curve: ReferenceCurve = BASKETBALL_REFERENCE_CURVE,
  today: number = Date.now()
): BasketballPace | null {
  const measured = measureSkilledWindow(entries, BASKETBALL_SKILLS, SKILLED_WINDOW);
  if (!measured) return null;
  const { usable, first, last, spanDays, cleaned, campDaysPerSeason, campDaysAssumed } = measured;

  const total = BASKETBALL_SKILLS.reduce((sum, skill) => sum + cleaned.gains[skill], 0);
  const pointsPerDay = total / cleaned.measuredDays;
  const ratedPointsPerDay =
    RATED_SKILLS.reduce((sum, skill) => sum + cleaned.gains[skill], 0) / cleaned.measuredDays;
  const skillShares = Object.fromEntries(
    BASKETBALL_SKILLS.map((skill) => [
      skill,
      total > 0 ? Math.max(0, cleaned.gains[skill]) / total : 0,
    ])
  ) as Record<Skill, number>;

  const midAge =
    (entryAge(first.date, currentExactAge, today) + entryAge(last.date, currentExactAge, today)) / 2;
  const reference = referencePerDay(curve, midAge);

  return {
    pointsPerDay,
    pointsPerSeason: pointsPerDay * DAYS_PER_SEASON,
    ratedPointsPerDay,
    skillShares,
    referencePerDay: reference,
    pace: reference && reference > 0 ? ratedPointsPerDay / reference : null,
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
 * A rate's rise between two ages, each year weighted by its age factor and,
 * before CAMP_UNTIL_AGE, by the camp allowance (each camp day adds
 * CAMP_DAY_EXTRA of a normal day; the rate is camp-free). Stops after
 * REFERENCE_LAST_AGE. Shared by the skill and OR references.
 */
function adjustedRiseBetween(
  perSeason: (age: number) => number,
  factor: (age: number) => number,
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
    const camps = age < CAMP_UNTIL_AGE ? campBoost : 1;
    total += perSeason(age) * factor(age) * camps * (segmentEnd - age);
    age = segmentEnd;
  }
  return total;
}

/**
 * The reference's rated points between two ages, with the age factors and
 * the camp allowance - what a 100% (underlying) pace spends on the rating.
 */
export function referencePointsBetween(
  curve: ReferenceCurve,
  fromAge: number,
  toAge: number,
  campDaysPerSeason: number
): number {
  return adjustedRiseBetween(
    (age) => (referencePerDay(curve, age) ?? 0) * DAYS_PER_SEASON,
    agePaceFactor,
    fromAge,
    toAge,
    campDaysPerSeason
  );
}

/** The top-5% OR line's smoothed gain per season (smoothedOrSeasonGains), by whole age. */
export const OR_SMOOTHED_SEASON_GAINS = smoothedOrSeasonGains(relativeOrReference);

/**
 * The OR pace's age factors, the same bands and data as AGE_PACE_FACTORS
 * (scripts/measure-age-factors.ts SPORT=basketball METRIC=or
 * ERA_START=2000-01-01; OR pace 65% at <=21): 1.00 / 0.81 / 0.47, 28+
 * carried from 25-27 (3 players measured 0.41). The OR line's rate peaks at
 * 25-26 (145 a season against 95 at 15-21) while the squad keeps slowing, so
 * the OR factors fall further than the skill ones.
 */
export const OR_AGE_PACE_FACTORS: readonly { fromAge: number; factor: number }[] = [
  { fromAge: 0, factor: 1.0 },
  { fromAge: 22, factor: 0.81 },
  { fromAge: 25, factor: 0.47 },
  { fromAge: 28, factor: 0.47 },
];

const orRateAt = (age: number): number | null => {
  if (!Number.isFinite(age) || age >= REFERENCE_LAST_AGE + 1) return null;
  const gain = OR_SMOOTHED_SEASON_GAINS[Math.floor(age)];
  return gain !== undefined && gain > 0 ? gain : null;
};

/**
 * The OR view's model (createOrModel in src/base/orGrowth.ts), as hockey's and
 * soccer's: OR points per season against the top-5% OR line's smoothed gain
 * at the window's middle age, its own age factors, the camp allowance, and
 * projections to REFERENCE_LAST_AGE + 1. For a player with skills it is
 * measured on the skill pace's window over all seven skills, while that
 * window is fresh (OR_BASIS_AFTER_DAYS); an unscouted player's, or one seen
 * only on his profile since, is read from his OR numbers end to end.
 */
export function basketballOrModel(today: number = Date.now()) {
  const orFactor = (age: number) => factorIn(OR_AGE_PACE_FACTORS, age);
  return createOrModel({
    gain: {
      skillNames: BASKETBALL_SKILLS,
      daysPerSeason: DAYS_PER_SEASON,
      pace: {
        windowDays: PACE_WINDOW_DAYS,
        minSpanDays: PACE_MIN_SPAN_DAYS,
        provisionalMinDays: PACE_PROVISIONAL_MIN_DAYS,
      },
      camps: SKILLED_WINDOW.camps,
      cleaning: CLEANING,
    },
    ageOn: (date, currentExactAge) => entryAge(date, currentExactAge, today),
    expectedSeasonGain: orRateAt,
    agePaceFactor: orFactor,
    adjustedGainBetween: (fromAge, toAge, campDays) =>
      adjustedRiseBetween((age) => orRateAt(age) ?? 0, orFactor, fromAge, toAge, campDays),
    maxAge: REFERENCE_LAST_AGE + 1,
  });
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
 * fraction of the top-5% line's rate:
 *
 * - Rated points = the pace, with the age factor it was measured at divided
 *   out, x the reference's rated points from now to the target (each year's
 *   factor and camps included). They go into the five rated skills, spent
 *   balanced for each position in turn; the best resulting position wins, so
 *   a growing 16-year-old can project into a different position.
 * - Shooting and blocking keep their own observed rate, carried along the
 *   same age-adjusted curve (as hockey's non-main skills).
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

  const measuredFactor = agePaceFactor(pace.midAge);
  const curvePoints = referencePointsBetween(curve, currentExactAge, targetAge, pace.campDaysPerSeason);
  const ratedPoints = (Math.max(0, pace.pace) / measuredFactor) * curvePoints;
  // Normal training days the curve's rise stands for, at the measured age's
  // rate and factor: the bonus skills' own rates are carried over these.
  // curvePoints already sums each future age's own rate x factor x camps, so
  // this is the per-age sum of (rate at age / rate measured) x (factor at age
  // / factor measured) x days: the bonus skills slow with the line, age by
  // age, as in src/base/growthModel.ts projectSkills. So the bonus skills
  // never outrun their own rate by more than the line rises after the
  // measured age: from 16 it doesn't rise, and measured at 15 they follow the
  // line's rise from 15 to 16. A small measured rate can't inflate it. The
  // basketball-growth check sums it a year at a time and checks that bound
  // for every measured age from 15.
  const curveDays =
    pace.referencePerDay && pace.referencePerDay > 0 ? curvePoints / (pace.referencePerDay * measuredFactor) : 0;
  const bonusPoints = (skill: Skill) => Math.max(0, pace.pointsPerDay * pace.skillShares[skill]) * curveDays;
  const points = ratedPoints + bonusPoints("shooting") + bonusPoints("blocking");

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
    projected.shooting = skills.shooting + bonusPoints("shooting");
    projected.blocking = skills.blocking + bonusPoints("blocking");

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
 * rests on one snapshot. Future XP accrues at this rate for everyone.
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
 * XP at `targetAge`: the XP the player has now plus the squad's typical gains
 * from here. A player's own past rate isn't carried forward - it reflects
 * playing time wherever he was, not at this team (a bought soccer junior's
 * elite-team share once projected a 5-diamond potential). The same rule as
 * hockey and soccer (projectExperience in src/base/growthModel.ts).
 */
export function projectBasketballXp(experience: number, currentExactAge: number, targetAge: number): number {
  return experience + typicalXpAt(targetAge) - typicalXpAt(currentExactAge);
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
