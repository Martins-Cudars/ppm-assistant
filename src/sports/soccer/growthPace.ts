/**
 * Soccer's growth pace: the shared growth model (src/base/growthModel.ts)
 * bound to soccer's skills, positions and the top-5% line (the global
 * relative-skill reference, src/sports/soccer/relativeSkillReference.ts), with the
 * constants measured on the user's FC Skanste (31 players, 21,223 days,
 * gathered 2026-10-01 - docs/skill-history.md, Soccer phase 2).
 *
 * Soccer trains one skill a day, but over a season the gains land on the
 * position's ratios (an SM's secondaries at 0.52 / 0.75 / 0.54 / 0.25 of
 * midfield vs ratios 0.5 / 0.75 / 0.5 / 0.25) - so hockey's measure, points
 * into the position's skills / Σweights, applies unchanged.
 */

import { positionSettings } from "@/sports/soccer/settings";
import { relativeOrReference, relativeSkillReference } from "@/sports/soccer/relativeSkillReference";
import { smoothedOrSeasonGains, smoothedSeasonGains } from "@/base/relativeSkillFit";
import { createOrGrowthModel } from "@/base/orGrowth";
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
 * The squad's own decline from 24 on, as a share of its gain at 23 (from the
 * 2026-10-01 gather: 25, 24, 19, 16, 12 a season at 24-28; 30-34 rest on one
 * player and are extrapolated).
 */
export const SQUAD_SLOPE_SHARE_FROM_24: Readonly<Record<number, number>> = {
  24: 0.92,
  25: 0.88,
  26: 0.7,
  27: 0.6,
  28: 0.44,
  29: 0.38,
  30: 0.28,
  31: 0.18,
  32: 0.1,
  33: 0.04,
  34: 0,
};

/**
 * The 100% growth rate up to 23: the top-5% line's gains smoothed
 * (smoothedSeasonGains), not its raw yearly steps (42, 88, 62 a season at
 * 15-17; 65, 30, 4, 22 at 24-27).
 */
export const SMOOTHED_SEASON_GAINS = smoothedSeasonGains(relativeSkillReference);

/**
 * The 100% rate from 24 on: the squad's own decline, scaled to meet the
 * smoothed rate at 23. The user's choice, kept from the old table, whose
 * slope collapsed after 23 while the squad kept gaining.
 */
const slopeAt23 = SMOOTHED_SEASON_GAINS[23];
export const REFERENCE_SLOPE_FROM_24: Readonly<Record<number, number>> = Object.fromEntries(
  Object.entries(SQUAD_SLOPE_SHARE_FROM_24).map(([age, share]) => [age, Math.round(share * slopeAt23)])
);

/**
 * How fast players pace at each age against that reference, relative to 17+
 * (1.0). Re-measured 2026-11-23 against the smoothed rate on the 2026-11-22
 * backup with scripts/measure-age-factors.ts (SPORT=soccer, all history):
 * 17+ paces a median 53% (27 players), 15 95% (26), 16 66% (28). Juniors pace
 * faster, and the line's smoothed rate starts at only 42 a season at 15, so
 * the factors divide that out: a junior's pace isn't carried to 25. The
 * measured pace is divided by its age's factor and each future year applies
 * its own, as hockey's bands do. Against the old table these were 1.4 / 1.18,
 * against the line's raw steps 1.74 / 0.80.
 */
export const AGE_PACE_FACTORS: readonly { fromAge: number; factor: number }[] = [
  { fromAge: 0, factor: 1.78 },
  { fromAge: 16, factor: 1.23 },
  { fromAge: 17, factor: 1.0 },
];

export const PROJECTION_MAX_AGE = 35;
export const POTENTIAL_AGE = 32;

/**
 * XP as a share of the top-5% line's `exp`: median own-squad XP / the line's
 * XP on the 2026-11-22 backup cache, 0.43 under 22 (12 players), 0.40 from 22
 * (16 players); against the old table 0.45 / 0.52. Future XP accrues at this
 * share for everyone; a player's own past share isn't carried forward (an
 * elite-team junior's 1.69 once projected 401 XP at 32 - see
 * projectExperience in growthModel.ts).
 */
export const SQUAD_XP_SHARE: readonly { fromAge: number; share: number }[] = [
  { fromAge: 0, share: 0.43 },
  { fromAge: 22, share: 0.4 },
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
  growthTable: relativeSkillReference,
  referenceSlopeOverrides: { ...SMOOTHED_SEASON_GAINS, ...REFERENCE_SLOPE_FROM_24 },
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

/**
 * The OR view's pace and projection (src/base/orGrowth.ts), on the skill
 * model's pattern: the top-5% OR line's smoothed rate up to 23, and from 24
 * the squad's same decline (SQUAD_SLOPE_SHARE_FROM_24) scaled to meet it at
 * 23. Same age factors, camp allowance and age limit as the skill model.
 */
export const OR_SMOOTHED_SEASON_GAINS = smoothedOrSeasonGains(relativeOrReference);
const orSlopeAt23 = OR_SMOOTHED_SEASON_GAINS[23];
export const OR_REFERENCE_SLOPE_FROM_24: Readonly<Record<number, number>> = Object.fromEntries(
  Object.entries(SQUAD_SLOPE_SHARE_FROM_24).map(([age, share]) => [age, Math.round(share * orSlopeAt23)])
);

/**
 * The OR pace's age factors, the same bands as AGE_PACE_FACTORS. Measured
 * 2026-11-23 with scripts/measure-age-factors.ts SPORT=soccer METRIC=or
 * ERA_START=2000-01-01 on the 2026-11-22 backup, all history as for the skill
 * factors (OR pace 55% from 17): 1.35 at 15, 1.23 at 16 (26 / 28 players).
 * Against the rating line the base pace reads 1.78 at 15: that line's
 * smoothed gain at 15 is lower relative to 17+ than the OR line's, so the
 * skill factor would divide a 15-year-old's OR pace by too much and project
 * him low.
 */
export const OR_AGE_PACE_FACTORS: readonly { fromAge: number; factor: number }[] = [
  { fromAge: 0, factor: 1.35 },
  { fromAge: 16, factor: 1.23 },
  { fromAge: 17, factor: 1.0 },
];

export const { measureOrPace, projectOr, orProjectionPoints, orExpectedSeasonGain, orAgePaceFactor } =
  createOrGrowthModel(soccerGrowthConfig, {
    line: relativeOrReference,
    slopes: { ...OR_SMOOTHED_SEASON_GAINS, ...OR_REFERENCE_SLOPE_FROM_24 },
    agePaceFactors: OR_AGE_PACE_FACTORS,
  });
