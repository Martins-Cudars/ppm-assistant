/**
 * Growth pace: how fast a player is actually being trained, measured against
 * the top-player curve in playerGrowthPrediction, and where that pace lands
 * them if it holds.
 *
 * Pure functions only - no DOM, no chrome API - so the same numbers back the
 * Player Report's Pace / Proj columns and the profile chart's projection line.
 *
 * Pace is measured in skill points, not in rating movement. A position's base
 * rating is min(main / 1, sec1 / 0.5, sec2 / 0.5), so it only moves when the
 * bottleneck skill does:
 *
 * - A young player catching up their bottleneck turns ~1 skill point into ~1
 *   rating point, where balanced training costs 2. Measured by rating, a
 *   15-year-old training only defence read 97% when the honest figure was ~57%.
 * - Points going into a skill that isn't the bottleneck don't move the rating
 *   at all, so a player being trained hard could read as 0%.
 *
 * Counting the points put into the position's main skills avoids both.
 *
 * Per-skill training quality is deliberately NOT used. Checked against the
 * Aug 2026 backup (37 own-team players): the two secondary skills gained
 * within ~5% of each other however far apart their qualities were (e.g. 52 vs
 * 86), the main skill gained 2x a secondary, and neither the gain split
 * (r = -0.03, n = 1013 windows) nor the overall pace (r = -0.08) tracked
 * quality. Gains follow the position's 1 : 0.5 : 0.5 split. Weighting by
 * quality would have made the numbers worse. See docs/skill-history.md.
 */

import { playerGrowthPrediction, positionSettings } from "@/sports/hockey/settings";
import { hockeyPlayerProfile } from "@/sports/hockey/playerProfile";
import { calculatePositions } from "@/classes/playerCalculations";
import { calculateSkillWithExp } from "@/base/calculations";
import { HockeySkills } from "@/sports/hockey/classes/HockeyPlayer";
import { SkillHistoryEntry } from "@/types/SkillHistory";
import { historyEntryAge } from "@/sports/hockey/skillHistoryChart";
import { cleanedGains, daysBetween } from "@/base/gainCleaning";

type SkillName = keyof HockeySkills;

const SKILL_NAMES: SkillName[] = [
  "goalie",
  "defence",
  "offence",
  "shooting",
  "passing",
  "technical",
  "aggression",
];

/**
 * How far back from a player's latest usable entry the pace is measured.
 *
 * 56 rather than 28: single months are noisy. One player's 28-day paces ranged
 * 52-64% within a season, and projecting from his best month overshot his
 * actual rating at 25 by 15%. The cost is reacting to a training change about
 * four weeks later.
 */
export const PACE_WINDOW_DAYS = 56;

/**
 * The fewest measured days (after skipping no-training and camp days) for a
 * full pace - half the window, so a couple of weeks can't be extrapolated to a
 * whole season as if it were settled.
 */
export const PACE_MIN_SPAN_DAYS = 28;

/**
 * The fewest measured days for a provisional pace. Newly arrived 15-year-olds
 * would otherwise show nothing for a month; from two weeks they get a pace
 * marked as provisional instead.
 */
export const PACE_PROVISIONAL_MIN_DAYS = 14;

// Camp detection (CAMP_MIN_RUN_DAYS, CAMP_GAIN_RATIO) and the no-training rule
// are shared with basketball: see src/base/gainCleaning.ts.

/**
 * The camp allowance projections add back. Pace skips camp days so it
 * describes normal training, but camps aren't windfalls: the game lets a team
 * send ~20 players twice a season, at most 14 camp days per player per 112-day
 * season. Leaving them out of projections made campers' @25 ~10% too low.
 *
 * From the Aug 2026 backup: a camp day gains 1.98x a normal day (median over
 * 466 camp days), so each one adds about one extra day of training; blocks
 * started Jul 13, Nov 2, Feb 23 and Jun 13 - one per season; and all 21
 * players seen at camp were 15.9-21.9, none 22 or older.
 */
export const CAMP_MAX_DAYS_PER_SEASON = 14;
export const CAMP_DAY_EXTRA = 1.0;
export const CAMP_UNTIL_AGE = 22;
/** How far back a player's own camp record is read: one season. */
export const CAMP_LOOKBACK_DAYS = 112;

/**
 * How fast players train at each age, relative to ages 16-21, at the user's
 * own team. Projections slow down by these factors on top of the top-player
 * curve's own slowdown, which on its own was too optimistic after 21.
 *
 * Measured 2026-09-26 from the Aug 28 backup, 56-day windows since 2025-12-01,
 * as median BASE pace (basePace - the part projections scale) per age band
 * divided by the <=21 median (56%), with no-training and camp days skipped:
 *
 *   <=21   1.00   23 players, the reference
 *   22-24  0.95   12 players  (0.95 since Mar)
 *   25-27  0.67   13 players  (0.71 since Mar)
 *   28+    0.49    4 players  (0.51 since Mar)
 *
 * Before injuries and camps were skipped these read 0.87 / 0.64 / 0.47. Much
 * of the apparent slowdown after 21 was camps, which only the youth get and
 * which inflated the reference, plus injuries; the real drop comes at 25.
 *
 * Why players compared over the same months, not each player's own history:
 * the team's training facilities changed several times over ten seasons, and
 * some players arrived from elite teams, so one player's history mixes
 * facility levels. Different players over the same months all train under
 * the same facilities, which is exactly what a projection at this team needs.
 * 2025-12-01 is after the last upgrade (visible as a pace jump around Nov
 * 2025). Age 15 measured ~0.9 on 5-7 players, but early weeks are often
 * catch-up training, so it stays at 1.00.
 *
 * The 22-24 and especially 28+ bands rest on few players. Re-measure with
 * scripts/measure-age-factors.ts as more history accumulates, or after the
 * facilities change again.
 */
export const AGE_PACE_FACTORS: readonly { fromAge: number; factor: number }[] = [
  { fromAge: 0, factor: 1.0 },
  { fromAge: 22, factor: 0.95 },
  { fromAge: 25, factor: 0.67 },
  { fromAge: 28, factor: 0.49 },
];

/** The age factor for an exact age - see AGE_PACE_FACTORS. */
export function agePaceFactor(age: number): number {
  let factor = AGE_PACE_FACTORS[0].factor;
  for (const band of AGE_PACE_FACTORS) {
    if (age >= band.fromAge) factor = band.factor;
  }
  return factor;
}

/**
 * The age projections stop at. The top-player curve turns to decline after 35,
 * where "pace relative to the curve" stops meaning anything.
 */
export const PROJECTION_MAX_AGE = 35;

export interface GrowthPace {
  /** The position whose main skills were counted, e.g. "D". */
  position: string;
  /** Skill points per season put into the position's main skills. */
  pointsPerSeason: number;
  /**
   * The base rating per season those points buy under balanced training -
   * pointsPerSeason divided by the position's summed weights (2 for every
   * hockey position).
   */
  basePerSeason: number;
  /**
   * How fast the position's bonus grows: while capped (at 0.6 x base) it
   * rises with the base; otherwise it's the bonus skills' points per season
   * times their bonus weights (e.g. 0.45 x shooting for a winger).
   */
  bonusPerSeason: number;
  /**
   * Base plus bonus per season - the growth of the position rating with bonus
   * (no XP), which is what the top-player curve's `skill` column measures.
   * This is what `pace` compares against the curve.
   */
  gainPerSeason: number;
  /**
   * How fast the position's base rating actually moved. Differs from
   * basePerSeason while a bottleneck is being caught up, or while points go
   * into a skill that isn't the bottleneck. Shown for context only.
   */
  ratingMovedPerSeason: number;
  /** Points per season for every skill, for projecting the non-main ones. */
  skillRates: Record<SkillName, number>;
  /**
   * The top-player gain per season at the window's midpoint age, or null
   * where the curve has none to compare against (35 and over).
   */
  expectedPerSeason: number | null;
  /** gainPerSeason / expectedPerSeason, e.g. 0.66 for 66%. Null with it. */
  pace: number | null;
  /**
   * basePerSeason / expectedPerSeason: the main-skill part of the pace alone.
   * Projections spend main-skill points from this, and project bonus skills
   * at their own rates, so the bonus isn't counted twice. AGE_PACE_FACTORS
   * are measured on this too.
   */
  basePace: number | null;
  /** The player's age at the middle of the window. */
  midAge: number;
  fromDate: string;
  toDate: string;
  /** Calendar days from fromDate to toDate. */
  spanDays: number;
  /** Days the rates were measured over: spanDays minus the skipped days. */
  measuredDays: number;
  /** Days with no training at all (injured, or none selected), left out. */
  skippedNoTrainingDays: number;
  /** Training-camp days, left out. */
  skippedCampDays: number;
  /** Fewer than PACE_MIN_SPAN_DAYS measured days: shown, but marked. */
  provisional: boolean;
  /**
   * Camp days a season the projection assumes until CAMP_UNTIL_AGE: the camp
   * days in the player's last season of history (0-14), or the full 14 when
   * there isn't a season of history yet (campDaysAssumed).
   */
  campDaysPerSeason: number;
  campDaysAssumed: boolean;
}

/** Whole days between two ISO dates. UTC arithmetic, so DST can't skew it. */
/** A position's main skills and their weights, e.g. D: defence 1, passing 0.5, aggression 0.5. */
function mainWeights(positionName: string): [SkillName, number][] | null {
  const rule = positionSettings.find((p) => p.name === positionName);
  if (!rule) return null;

  return (Object.entries(rule.ratios) as [SkillName, number | undefined][])
    .filter((pair): pair is [SkillName, number] => typeof pair[1] === "number" && pair[1] > 0);
}

/** A position's bonus skills and their weights, e.g. W: shooting 0.45, defence 0.1. */
function bonusWeights(positionName: string): [SkillName, number][] {
  const rule = positionSettings.find((p) => p.name === positionName);
  return (Object.entries(rule?.bonus ?? {}) as [SkillName, number | undefined][]).filter(
    (pair): pair is [SkillName, number] => typeof pair[1] === "number" && pair[1] > 0
  );
}

/** The position's base rating, unrounded - the bottleneck skill over its weight. */
function positionBase(skills: HockeySkills, weights: [SkillName, number][]): number {
  return Math.min(...weights.map(([skill, weight]) => (skills[skill] ?? 0) / weight));
}

/** The position's rating with bonus, through the same formula the game columns use. */
function positionRating(skills: HockeySkills, positionName: string): number | null {
  const position = calculatePositions(
    skills,
    hockeyPlayerProfile.positionSettings,
    0,
    hockeyPlayerProfile.bonusCapRatio ?? 1
  ).find((p) => p.name === positionName);

  return position ? position.ratingWithBonus : null;
}

/**
 * The top-player base-rating gain per season at an exact age.
 *
 * The prediction table gives skill at whole ages, and the chart draws straight
 * lines between them, so the gain rate is constant within each year of age:
 * skill[floor(age) + 1] - skill[floor(age)]. That's exactly the slope of the
 * drawn curve, which is what makes a 100% pace project onto it exactly.
 *
 * Null outside the table and from 35 on, where the curve stops growing and a
 * ratio against it would be meaningless (or flip sign).
 */
export function expectedSeasonGain(age: number): number | null {
  if (!Number.isFinite(age) || age >= PROJECTION_MAX_AGE) return null;

  const whole = Math.floor(age);
  const from = playerGrowthPrediction.find((p) => p.age === whole);
  const to = playerGrowthPrediction.find((p) => p.age === whole + 1);
  if (!from || !to) return null;

  const gain = to.skill - from.skill;
  return gain > 0 ? gain : null;
}

/**
 * How much the top-player curve rises between two ages, stopping at 35. Walks
 * year by year, so the curve's slowdown with age is carried into anything
 * scaled by it.
 */
export function curveGainBetween(fromAge: number, toAge: number): number {
  const endAge = Math.min(toAge, PROJECTION_MAX_AGE);
  let total = 0;
  let age = fromAge;

  while (age < endAge) {
    const segmentEnd = Math.min(Math.floor(age) + 1, endAge);
    const gain = expectedSeasonGain(age);
    if (gain === null) break;

    total += gain * (segmentEnd - age);
    age = segmentEnd;
  }

  return total;
}

/**
 * The curve's rise between two ages, each year weighted by agePaceFactor() -
 * how much a player at 100% of the reference (ages 16-21) pace would actually
 * gain at this team. The factor bands start on whole ages, and the walk steps
 * through whole ages, so each segment sits in exactly one band.
 *
 * Years before CAMP_UNTIL_AGE also get the camp allowance: each camp day a
 * season adds CAMP_DAY_EXTRA of a normal day to the 112-day season. 22 is a
 * whole age too, so no segment straddles it.
 */
export function adjustedCurveGainBetween(
  fromAge: number,
  toAge: number,
  campDaysPerSeason = 0
): number {
  const campBoost =
    1 + (campDaysPerSeason * CAMP_DAY_EXTRA) / hockeyPlayerProfile.daysPerSeason;
  const endAge = Math.min(toAge, PROJECTION_MAX_AGE);
  let total = 0;
  let age = fromAge;

  while (age < endAge) {
    const segmentEnd = Math.min(Math.floor(age) + 1, endAge);
    const gain = expectedSeasonGain(age);
    if (gain === null) break;

    const camps = age < CAMP_UNTIL_AGE ? campBoost : 1;
    total += gain * agePaceFactor(age) * camps * (segmentEnd - age);
    age = segmentEnd;
  }

  return total;
}

/**
 * The player's recent growth pace for a position, or null when there isn't
 * enough history to measure one honestly.
 *
 * The window ends at the player's latest entry that carries skills - not at
 * today - so a player last seen a while ago still gets a pace for that period;
 * callers should show `toDate` so it can't be mistaken for a current figure.
 * Entries without skills (an unscouted opponent's profile) are ignored rather
 * than read as zero.
 */
export function measureGrowthPace(
  entries: SkillHistoryEntry[],
  currentExactAge: number,
  positionName: string
): GrowthPace | null {
  const weights = mainWeights(positionName);
  if (!weights || weights.length === 0) return null;

  const usable = entries
    .filter((entry): entry is SkillHistoryEntry & { skills: HockeySkills } => !!entry.skills)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (usable.length < 2) return null;

  const last = usable[usable.length - 1];
  const first = usable.find((entry) => daysBetween(entry.date, last.date) <= PACE_WINDOW_DAYS);
  if (!first || first === last) return null;

  const spanDays = daysBetween(first.date, last.date);
  const cleaned = cleanedGains(usable.slice(usable.indexOf(first)), SKILL_NAMES, spanDays);
  if (cleaned.measuredDays < PACE_PROVISIONAL_MIN_DAYS) return null;

  // The camp record reads a full season, not just the pace window - camps come
  // once a season, so 56 days can easily miss one. Without a season of
  // history, assume the full allowance until the player's own record exists.
  const seasonStart = usable.find(
    (entry) => daysBetween(entry.date, last.date) <= CAMP_LOOKBACK_DAYS
  )!;
  const seasonSpan = daysBetween(seasonStart.date, last.date);
  const campDaysAssumed = daysBetween(usable[0].date, last.date) < CAMP_LOOKBACK_DAYS;
  const campDaysPerSeason = campDaysAssumed
    ? CAMP_MAX_DAYS_PER_SEASON
    : Math.min(
        CAMP_MAX_DAYS_PER_SEASON,
        cleanedGains(usable.slice(usable.indexOf(seasonStart)), SKILL_NAMES, seasonSpan).skippedCampDays
      );

  const perSeason = (value: number) =>
    (value / cleaned.measuredDays) * hockeyPlayerProfile.daysPerSeason;

  const skillRates = Object.fromEntries(
    SKILL_NAMES.map((skill) => [skill, perSeason(cleaned.gains[skill])])
  ) as Record<SkillName, number>;

  const pointsPerSeason = weights.reduce((sum, [skill]) => sum + skillRates[skill], 0);
  const weightSum = weights.reduce((sum, [, weight]) => sum + weight, 0);
  const basePerSeason = pointsPerSeason / weightSum;

  // The bonus counts too: the top-player curve's `skill` is the position rating
  // WITH bonus (the profile card and chart already compare it that way), so a
  // base-only pace understated every winger and centre - shooting feeds their
  // bonus at 0.45. Measured from skill rates, not from how the capped bonus
  // moved, for the same reason the base is: movement through min() and a cap
  // misreports training. While the bonus sits at its cap it can only rise with
  // the base, whatever the bonus skills do.
  const bonus = bonusWeights(positionName);
  const lastBase = positionBase(last.skills, weights);
  const rawBonus = bonus.reduce((sum, [skill, weight]) => sum + (last.skills[skill] ?? 0) * weight, 0);
  const bonusCapRatio = hockeyPlayerProfile.bonusCapRatio ?? 1;
  const bonusPerSeason =
    rawBonus >= lastBase * bonusCapRatio
      ? basePerSeason * bonusCapRatio
      : bonus.reduce((sum, [skill, weight]) => sum + Math.max(0, skillRates[skill]) * weight, 0);
  const gainPerSeason = basePerSeason + bonusPerSeason;

  const midAge =
    (historyEntryAge(first, currentExactAge) + historyEntryAge(last, currentExactAge)) / 2;
  const expectedPerSeason = expectedSeasonGain(midAge);

  return {
    position: positionName,
    pointsPerSeason,
    basePerSeason,
    bonusPerSeason,
    gainPerSeason,
    // Endpoint-to-endpoint on purpose: this is context for "the rating itself
    // moved", i.e. what actually happened over the calendar window.
    ratingMovedPerSeason:
      ((lastBase - positionBase(first.skills, weights)) / spanDays) *
      hockeyPlayerProfile.daysPerSeason,
    skillRates,
    expectedPerSeason,
    pace: expectedPerSeason === null ? null : gainPerSeason / expectedPerSeason,
    basePace: expectedPerSeason === null ? null : basePerSeason / expectedPerSeason,
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
  };
}

/**
 * The highest base rating `points` skill points can buy for a position, if
 * they're spent where they raise the rating most: the bottleneck first, then
 * all main skills together at their weights.
 *
 * Solves sum(max(0, R * weight - skill)) = points for R. Skill already above
 * what R needs counts as paid for - which is exactly the catch-up a young
 * player with one lagging skill gets, and why their rating can jump before
 * settling to 2 points per rating point.
 */
export function solveBalancedRating(
  skills: HockeySkills,
  positionName: string,
  points: number
): number | null {
  const weights = mainWeights(positionName);
  if (!weights || weights.length === 0) return null;

  const cost = (rating: number) =>
    weights.reduce(
      (sum, [skill, weight]) => sum + Math.max(0, rating * weight - (skills[skill] ?? 0)),
      0
    );

  const weightSum = weights.reduce((sum, [, weight]) => sum + weight, 0);
  const skillSum = weights.reduce((sum, [skill]) => sum + (skills[skill] ?? 0), 0);
  const highestThreshold = Math.max(
    ...weights.map(([skill, weight]) => (skills[skill] ?? 0) / weight)
  );

  // cost() is increasing, and at `high` it is already >= points: past the
  // highest threshold every skill is being paid for, so cost = R*sum - skills.
  let low = positionBase(skills, weights);
  let high = Math.max(highestThreshold, (Math.max(0, points) + skillSum) / weightSum);

  for (let i = 0; i < 60; i++) {
    const middle = (low + high) / 2;
    if (cost(middle) <= points) low = middle;
    else high = middle;
  }

  // Snap away bisection dust: overall rating floors each skill, so 550.9999999
  // would lose a whole point that 551 keeps.
  return Math.round(low * 1e6) / 1e6;
}

/**
 * Where the player's rating for the paced position lands at `targetAge`, if
 * they keep being trained at the same fraction of the top-player rate -
 * slowing with age as this team's players do (AGE_PACE_FACTORS).
 *
 * - The position's main skills get (pace / age factor now) x (age-adjusted
 *   curve gain to the target) x the position's weights in skill points,
 *   spent as solveBalancedRating() says.
 * - Every other skill (e.g. shooting for a winger, which feeds the bonus)
 *   keeps growing at its own observed rate, scaled by the same curve factor.
 * - The result goes through calculatePositions(), so the bonus and its cap
 *   are the real formula, not an approximation.
 *
 * Null without a pace, without skills, or at or past the target or 35.
 */
export function projectPositionRating(
  skills: HockeySkills | undefined,
  currentExactAge: number,
  pace: GrowthPace | null,
  targetAge: number
): number | null {
  const projected = projectSkills(skills, currentExactAge, pace, targetAge);
  return projected && pace ? positionRating(projected, pace.position) : null;
}

/**
 * The best position for a set of skills and its rating with bonus (no XP) -
 * the same figure readEntryBaseRating() gives, plus which position it is.
 */
export function bestPositionRating(skills: HockeySkills): { name: string; rating: number } {
  return calculatePositions(
    skills,
    hockeyPlayerProfile.positionSettings,
    0,
    hockeyPlayerProfile.bonusCapRatio ?? 1
  ).reduce(
    (best, position) =>
      position.ratingWithBonus > best.rating
        ? { name: position.name, rating: position.ratingWithBonus }
        : best,
    { name: "?", rating: -Infinity }
  );
}

/**
 * Overall rating from skills: the sum of the seven skills, each rounded down.
 *
 * Verified against the Aug 2026 backup: exact for all 16395 stored days and
 * all 68 cached players. The rounding matters - training-progress days carry
 * fractional skills, and a plain sum overshoots them (404.64 for an OR of 403).
 */
export function overallFromSkills(skills: HockeySkills): number {
  return SKILL_NAMES.reduce((sum, skill) => sum + Math.floor(skills[skill] ?? 0), 0);
}

/**
 * Where the player's overall rating lands at `targetAge` under the same
 * assumptions as projectPositionRating() - it sums the same projected skills.
 */
export function projectOverallRating(
  skills: HockeySkills | undefined,
  currentExactAge: number,
  pace: GrowthPace | null,
  targetAge: number
): number | null {
  const projected = projectSkills(skills, currentExactAge, pace, targetAge);
  return projected ? overallFromSkills(projected) : null;
}

/**
 * The calendar date on which the player was (or will be) `targetAge`, as ISO.
 *
 * Counts one season as 112 calendar days, the same assumption as
 * historyEntryAge() - so it drifts over many seasons if PPM has any gap
 * between them. Look it up with a tolerance (entryNearestDate), not exactly.
 */
export function dateAtAge(currentExactAge: number, targetAge: number): string {
  const daysAgo = (currentExactAge - targetAge) * hockeyPlayerProfile.daysPerSeason;
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The entry with skills closest to `isoDate`, within `maxDays` either side,
 * or null. Entries without skills are skipped - an OR-only profile visit can't
 * say what the player's position rating was.
 */
export function entryNearestDate(
  entries: SkillHistoryEntry[],
  isoDate: string,
  maxDays: number
): (SkillHistoryEntry & { skills: HockeySkills }) | null {
  let best: (SkillHistoryEntry & { skills: HockeySkills }) | null = null;
  let bestDistance = Infinity;

  for (const entry of entries) {
    if (!entry.skills) continue;
    const distance = Math.abs(daysBetween(isoDate, entry.date));
    if (distance <= maxDays && distance < bestDistance) {
      best = entry as SkillHistoryEntry & { skills: HockeySkills };
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * Every skill projected to `targetAge`: the paced position's main skills as
 * solveBalancedRating() spends them, the rest at their own observed rates.
 * Null under the same conditions as projectPositionRating().
 */
export function projectSkills(
  skills: HockeySkills | undefined,
  currentExactAge: number,
  pace: GrowthPace | null,
  targetAge: number
): HockeySkills | null {
  if (!skills || !pace || pace.basePace === null || pace.expectedPerSeason === null) return null;
  if (currentExactAge >= Math.min(targetAge, PROJECTION_MAX_AGE)) return null;

  const weights = mainWeights(pace.position);
  if (!weights) return null;

  // Main skills are driven by the base part of the pace only. The bonus part
  // comes from the bonus skills, which are projected below at their own rates
  // and fed through the real bonus formula - using the full pace here would
  // count the bonus twice.
  //
  // The measured pace already includes the age factor for the age it was
  // measured at (a 23-year-old at 50% is doing what a 20-year-old at ~57%
  // would). Divide it out, then let each future year apply its own factor.
  const measuredFactor = agePaceFactor(pace.midAge);
  const underlyingPace = Math.max(0, pace.basePace) / measuredFactor;
  // Pace is camp-free, so the camps the player will attend before 22 are added
  // back here - to every skill, as camps boost all training.
  const curveGain = adjustedCurveGainBetween(currentExactAge, targetAge, pace.campDaysPerSeason);
  const weightSum = weights.reduce((sum, [, weight]) => sum + weight, 0);
  const points = underlyingPace * curveGain * weightSum;

  const rating = solveBalancedRating(skills, pace.position, points);
  if (rating === null) return null;

  const main = new Map(weights);
  // The observed rate was measured when the curve's slope was expectedPerSeason
  // at that age's factor; scale it by the same age-adjusted curve the main
  // skills follow.
  const curveSeasons = curveGain / (pace.expectedPerSeason * measuredFactor);

  return Object.fromEntries(
    SKILL_NAMES.map((skill) => {
      const current = skills[skill] ?? 0;
      const weight = main.get(skill);
      const value =
        weight !== undefined
          ? Math.max(current, rating * weight)
          : current + Math.max(0, pace.skillRates[skill]) * curveSeasons;
      return [skill, value];
    })
  ) as HockeySkills;
}

/**
 * Chart points for the projection line: the player's current rating for the
 * paced position, then one point per whole age up to `untilAge` (capped at
 * 35). Empty without a pace.
 */
export function projectionPoints(
  skills: HockeySkills | undefined,
  currentExactAge: number,
  pace: GrowthPace | null,
  untilAge: number
): { x: number; y: number }[] {
  if (!skills || !pace || pace.basePace === null) return [];

  const current = positionRating(skills, pace.position);
  if (current === null) return [];

  const endAge = Math.min(untilAge, PROJECTION_MAX_AGE);
  const points = [{ x: currentExactAge, y: current }];

  for (let age = Math.floor(currentExactAge) + 1; age <= endAge; age++) {
    const y = projectPositionRating(skills, currentExactAge, pace, age);
    if (y !== null) points.push({ x: age, y });
  }

  return points.length > 1 ? points : [];
}

/**
 * The age "potential" projects to: roughly where skill with XP peaks. The
 * top-player curve's skill keeps rising to 35, but XP keeps adding on top, so
 * 32 is a practical peak. Further out than @25, so less certain - the same
 * model, just extrapolated longer.
 */
export const POTENTIAL_AGE = 32;

/**
 * Typical XP as a share of the top-player table's `exp` at the same age, at
 * the user's team. XP comes from ice time, and young players get less.
 * Measured on the Aug 2026 cache: median 0.45 at 15-21, 0.63 from 22 (regulars
 * mostly 0.55-0.75). Used as a floor, so a new player with no XP yet still
 * projects typical XP rather than none.
 */
export const SQUAD_XP_SHARE: readonly { fromAge: number; share: number }[] = [
  { fromAge: 0, share: 0.45 },
  { fromAge: 22, share: 0.63 },
];

const squadXpShare = (age: number) =>
  [...SQUAD_XP_SHARE].reverse().find((band) => age >= band.fromAge)!.share;

/** The top-player table's `exp` at an exact age, interpolated between whole ages. */
export function topExpAt(age: number): number {
  const table = playerGrowthPrediction;
  const first = table[0];
  const last = table[table.length - 1];
  if (age <= first.age) return first.exp;
  if (age >= last.age) return last.exp;

  const whole = Math.floor(age);
  const from = table.find((p) => p.age === whole)!;
  const to = table.find((p) => p.age === whole + 1)!;
  return from.exp + (to.exp - from.exp) * (age - whole);
}

/**
 * XP at `targetAge`: each future year gains the top player's XP gain for that
 * year times the player's share - his own current share, but never below the
 * squad's typical share for that age. XP isn't in the skill history, so this
 * rests on today's value alone.
 */
export function projectExperience(
  experience: number,
  currentExactAge: number,
  targetAge: number
): number {
  const topNow = topExpAt(currentExactAge);
  const ownShare = topNow > 0 ? experience / topNow : 0;

  let xp = experience;
  let age = currentExactAge;
  while (age < targetAge) {
    const segmentEnd = Math.min(Math.floor(age) + 1, targetAge);
    const share = Math.max(ownShare, squadXpShare(age));
    xp += (topExpAt(segmentEnd) - topExpAt(age)) * share;
    age = segmentEnd;
  }
  return xp;
}

export interface Potential {
  /** Position rating with bonus, no XP, at POTENTIAL_AGE (or now, if past it). */
  rating: number;
  /** XP at POTENTIAL_AGE (or now). */
  xp: number;
  /** Rating with XP - what the stars show. */
  ratingWithXp: number;
  /** "current" for players at or past POTENTIAL_AGE: they're at their peak already. */
  kind: "projected" | "current";
}

/**
 * The player's projected peak: rating with XP at POTENTIAL_AGE, using the same
 * model as the @25 columns (pace, age factors, camp allowance) plus projected
 * XP. Players already at or past that age show where they are now - past XP
 * isn't stored, so their actual peak can't be reconstructed.
 */
export function projectPotential(
  skills: HockeySkills | undefined,
  experience: number | undefined,
  currentExactAge: number,
  pace: GrowthPace | null,
  current: { rating: number; ratingWithXp: number }
): Potential | null {
  if (currentExactAge >= POTENTIAL_AGE) {
    return { ...current, xp: experience ?? 0, kind: "current" };
  }
  if (experience === undefined) return null;

  const rating = projectPositionRating(skills, currentExactAge, pace, POTENTIAL_AGE);
  if (rating === null) return null;

  const xp = projectExperience(experience, currentExactAge, POTENTIAL_AGE);
  return {
    rating,
    xp,
    ratingWithXp: calculateSkillWithExp(rating, xp),
    kind: "projected",
  };
}
