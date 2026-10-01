/**
 * Hockey's growth pace: the shared growth model (src/base/growthModel.ts)
 * bound to hockey's skills, positions, top-player table and the constants
 * measured on the user's own team. Every name the report, the profile chart
 * and test/growth-pace.check.ts import is exported here as before.
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
import { HockeySkills } from "@/sports/hockey/classes/HockeyPlayer";
import {
  GrowthConfig,
  GrowthPace as SharedGrowthPace,
  createGrowthModel,
} from "@/base/growthModel";

export type { Potential } from "@/base/growthModel";
export type GrowthPace = SharedGrowthPace<HockeySkills>;

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
// are shared with the other sports: see src/base/gainCleaning.ts.

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

/**
 * The age projections stop at. The top-player curve turns to decline after 35,
 * where "pace relative to the curve" stops meaning anything.
 */
export const PROJECTION_MAX_AGE = 35;

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

export const hockeyGrowthConfig: GrowthConfig<HockeySkills> = {
  skillNames: ["goalie", "defence", "offence", "shooting", "passing", "technical", "aggression"],
  positionSettings,
  bonusCapRatio: hockeyPlayerProfile.bonusCapRatio ?? 1,
  daysPerSeason: hockeyPlayerProfile.daysPerSeason,
  growthTable: playerGrowthPrediction,
  agePaceFactors: AGE_PACE_FACTORS,
  pace: {
    windowDays: PACE_WINDOW_DAYS,
    minSpanDays: PACE_MIN_SPAN_DAYS,
    provisionalMinDays: PACE_PROVISIONAL_MIN_DAYS,
  },
  camps: {
    maxDaysPerSeason: CAMP_MAX_DAYS_PER_SEASON,
    dayExtra: CAMP_DAY_EXTRA,
    untilAge: CAMP_UNTIL_AGE,
    lookbackDays: CAMP_LOOKBACK_DAYS,
  },
  xpShares: SQUAD_XP_SHARE,
  projectionMaxAge: PROJECTION_MAX_AGE,
  potentialAge: POTENTIAL_AGE,
};

const model = createGrowthModel(hockeyGrowthConfig);

export const {
  agePaceFactor,
  expectedSeasonGain,
  curveGainBetween,
  adjustedCurveGainBetween,
  measureGrowthPace,
  solveBalancedRating,
  projectPositionRating,
  bestPositionRating,
  overallFromSkills,
  projectOverallRating,
  dateAtAge,
  entryNearestDate,
  projectSkills,
  projectionPoints,
  topExpAt,
  projectExperience,
  projectPotential,
} = model;
