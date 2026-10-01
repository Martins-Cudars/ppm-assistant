/**
 * Soccer's growth pace: the shared growth model (src/base/growthModel.ts)
 * bound to soccer's skills, positions and top-player table, with the
 * constants measured on the user's FC Skanste (31 players, 21,223 days,
 * gathered 2026-10-01 - docs/skill-history.md, Soccer phase 2).
 *
 * Soccer trains one skill a day, but over a season the gains land on the
 * position's ratios (an SM's secondaries at 0.52 / 0.75 / 0.54 / 0.25 of
 * midfield vs ratios 0.5 / 0.75 / 0.5 / 0.25) - so hockey's measure, points
 * into the position's skills / Σweights, applies unchanged.
 */

import { playerGrowthPrediction, positionSettings } from "@/sports/soccer/settings";
import { soccerPlayerProfile } from "@/sports/soccer/playerProfile";
import { SoccerSkills } from "@/sports/soccer/classes/SoccerPlayer";
import {
  GrowthConfig,
  GrowthPace as SharedGrowthPace,
  createGrowthModel,
} from "@/base/growthModel";

export type { Potential } from "@/base/growthModel";
export type SoccerGrowthPace = SharedGrowthPace<SoccerSkills>;

/** Same windows as hockey: 56 days, full from 28 measured days, provisional from 14. */
export const PACE_WINDOW_DAYS = 56;
export const PACE_MIN_SPAN_DAYS = 28;
export const PACE_PROVISIONAL_MIN_DAYS = 14;

/**
 * Camps: the game allows 2 x 7 = 14 camp days a season (the user's rule), and
 * the history agrees - runs of 7 or 14 days, mostly 14 per player-season, at
 * 2.0x a normal day (p25-p75 1.93-2.11), used up to 21-22. As in hockey.
 */
export const CAMP_MAX_DAYS_PER_SEASON = 14;
export const CAMP_DAY_EXTRA = 1.0;
export const CAMP_UNTIL_AGE = 22;
export const CAMP_LOOKBACK_DAYS = 112;

/**
 * The 100% reference from 24 on. The top-player table's slope collapses after
 * 23 (20, 15, 10, 7, 5 a season) while the user's players keep gaining (25,
 * 24, 19, 16, 12) - against the raw table a typical 25-year-old read 160%.
 * The user's choice: the table up to 23, then the squad's own decline scaled
 * to meet the table at 23 (own[age] / own[23] x 50). 30-34 rest on one player
 * and are extrapolated.
 */
export const REFERENCE_SLOPE_FROM_24: Readonly<Record<number, number>> = {
  24: 46,
  25: 44,
  26: 35,
  27: 30,
  28: 22,
  29: 19,
  30: 14,
  31: 9,
  32: 5,
  33: 2,
  34: 0,
};

/**
 * Against that reference a typical player paces ~0.50 from 17 to 28 (0.45-0.55
 * per age), so from 17 the factor is 1.0. Juniors pace higher - median 0.70 at
 * 15 and 0.59 at 16 (24 and 26 players) - and without factors a 15-year-old's
 * pace was carried all the way to 25: ~554 projected, where today's
 * 25-year-olds reached 410-450. With them the measured pace is divided by its
 * age's factor and each future year applies its own, as hockey's bands do.
 */
export const AGE_PACE_FACTORS: readonly { fromAge: number; factor: number }[] = [
  { fromAge: 0, factor: 1.4 },
  { fromAge: 16, factor: 1.18 },
  { fromAge: 17, factor: 1.0 },
];

export const PROJECTION_MAX_AGE = 35;
export const POTENTIAL_AGE = 32;

/**
 * XP as a share of the table's `exp`, from the Oct 2026 cache: ~0.45 under 22
 * (0.34-0.71), ~0.52 from 22. A floor, as in hockey.
 */
export const SQUAD_XP_SHARE: readonly { fromAge: number; share: number }[] = [
  { fromAge: 0, share: 0.45 },
  { fromAge: 22, share: 0.52 },
];

export const soccerGrowthConfig: GrowthConfig<SoccerSkills> = {
  skillNames: [
    "goalie",
    "defence",
    "midfield",
    "offence",
    "shooting",
    "passing",
    "technical",
    "speed",
    "heading",
  ],
  positionSettings,
  bonusCapRatio: soccerPlayerProfile.bonusCapRatio ?? 1,
  daysPerSeason: soccerPlayerProfile.daysPerSeason,
  growthTable: playerGrowthPrediction,
  referenceSlopeOverrides: REFERENCE_SLOPE_FROM_24,
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
  // One skill a day, and a heading day gains a quarter of a midfield day - a
  // camp is told by comparing each day with normal days of the same skill.
  cleaning: { perSkillCampBaseline: true },
};

export const {
  agePaceFactor,
  historyEntryAge,
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
} = createGrowthModel(soccerGrowthConfig);
