/**
 * OR pace and the OR projection: the OR counterpart of the skill pace in
 * src/base/growthModel.ts, for the profile charts' OR view. Pure functions.
 *
 * How fast a player's OR grows is measured from his history in one of two
 * ways (measureOrGain):
 *
 * - **On skills**, when his history has a skilled window the skill pace
 *   would accept: the same window, cleaning and camp record
 *   (measureSkilledWindow in src/base/gainCleaning.ts), counting every
 *   skill's points. OR is the sum of the floored skills, so its growth is the
 *   skill points per season. OR-only days are ignored here, as the skill pace
 *   ignores them, so an occasional profile visit doesn't decide the basis.
 * - **On the OR numbers** when there is no such window (an unscouted player,
 *   whose profile shows only his OR), or when it has gone stale: its last day
 *   is more than OR_BASIS_AFTER_DAYS older than his newest OR-only day (a sold
 *   player now seen only on his profile). Measured end to end over the same window
 *   length. OR is a whole number and these days come from occasional profile
 *   visits, so no day can be judged as a camp or a no-training day; the rate
 *   is the calendar rate with whatever camps fell in the window, and the
 *   projection adds no camp allowance on top.
 *
 * createOrModel turns that into a pace and a projection against a reference
 * rate. Hockey and soccer use the top-5% OR line (relativeOrReference, the
 * fit's OR percentile before the rating share) through createOrGrowthModel:
 * pace = OR per season / the line's smoothed season gain at the window's
 * middle age, as the skill pace reads the top-5% rating line. Basketball
 * passes its squad reference instead (src/sports/basketball/growthModel.ts),
 * as its skill pace does.
 */

import { CleaningOptions, daysBetween, measureSkilledWindow } from "@/base/gainCleaning";
import { GrowthConfig, createGrowthModel } from "@/base/growthModel";
import { overallOrSkillSum } from "@/base/historyDownsample";
import { OrReference } from "@/base/relativeSkillFit";

/** A history row as the OR pace reads it: any sport's skills, or just an OR. */
export type OrHistoryEntry = {
  date: string;
  source?: string;
  skills?: object;
  overallRating?: number;
  /** Legacy name of overallRating in old hockey rows. */
  kr?: number;
};

export interface OrGainOptions {
  skillNames: readonly string[];
  daysPerSeason: number;
  pace: { windowDays: number; minSpanDays: number; provisionalMinDays: number };
  camps: { maxDaysPerSeason: number; lookbackDays: number };
  cleaning?: CleaningOptions;
}

export interface OrGain {
  /** "skills": skill points of skilled days, cleaned; "or": the OR numbers end to end. */
  basis: "skills" | "or";
  /** OR points per season over the measured days. */
  perSeason: number;
  fromDate: string;
  toDate: string;
  spanDays: number;
  measuredDays: number;
  skippedNoTrainingDays: number;
  skippedCampDays: number;
  /** Fewer than the full minimum of measured days: shown, but marked. */
  provisional: boolean;
  /** Camp days a season the projection adds back; 0 on the OR basis, whose rate includes them. */
  campDaysPerSeason: number;
  campDaysAssumed: boolean;
}

/** The skill pace's window and camp record, every skill's points counted. */
function measureOnSkills(entries: readonly OrHistoryEntry[], options: OrGainOptions): OrGain | null {
  const measured = measureSkilledWindow(entries, options.skillNames, {
    windowDays: options.pace.windowDays,
    provisionalMinDays: options.pace.provisionalMinDays,
    camps: options.camps,
    cleaning: options.cleaning,
  });
  if (!measured) return null;
  const { first, last, spanDays, cleaned } = measured;
  const points = options.skillNames.reduce((sum, skill) => sum + cleaned.gains[skill], 0);
  return {
    basis: "skills",
    perSeason: (points / cleaned.measuredDays) * options.daysPerSeason,
    fromDate: first.date,
    toDate: last.date,
    spanDays,
    measuredDays: cleaned.measuredDays,
    skippedNoTrainingDays: cleaned.skippedNoTrainingDays,
    skippedCampDays: cleaned.skippedCampDays,
    provisional: cleaned.measuredDays < options.pace.minSpanDays,
    campDaysPerSeason: measured.campDaysPerSeason,
    campDaysAssumed: measured.campDaysAssumed,
  };
}

/** The OR numbers end to end: every row with an OR (overallOrSkillSum). */
function measureOnOr(entries: readonly OrHistoryEntry[], options: OrGainOptions): OrGain | null {
  const usable = entries
    .map((entry) => ({
      date: entry.date,
      or: overallOrSkillSum(
        entry.overallRating ?? entry.kr,
        entry.skills as Partial<Record<string, number>> | undefined,
        options.skillNames
      ),
    }))
    .filter((row): row is { date: string; or: number } => row.or !== null && row.or > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (usable.length < 2) return null;

  const last = usable[usable.length - 1];
  const first = usable.find((row) => daysBetween(row.date, last.date) <= options.pace.windowDays)!;
  const spanDays = daysBetween(first.date, last.date);
  if (first === last || spanDays < options.pace.provisionalMinDays) return null;

  return {
    basis: "or",
    perSeason: ((last.or - first.or) / spanDays) * options.daysPerSeason,
    fromDate: first.date,
    toDate: last.date,
    spanDays,
    measuredDays: spanDays,
    skippedNoTrainingDays: 0,
    skippedCampDays: 0,
    provisional: spanDays < options.pace.minSpanDays,
    campDaysPerSeason: 0,
    campDaysAssumed: false,
  };
}

/**
 * How much older than the newest OR-only day the last skilled day may be
 * before the OR pace stops reading the skilled window: a month. A profile
 * visit or two after the last training-page day keeps the skills basis (and
 * so the skill pace's window); a player seen only on his profile for longer,
 * such as one sold to another team, is read from his recent OR numbers.
 */
export const OR_BASIS_AFTER_DAYS = 30;

/** The newest day with an OR but no skills, or null. */
function newestOrOnlyDate(entries: readonly OrHistoryEntry[]): string | null {
  let newest: string | null = null;
  for (const entry of entries) {
    if (entry.skills) continue;
    const or = entry.overallRating ?? entry.kr;
    if (typeof or === "number" && or > 0 && (newest === null || entry.date > newest)) newest = entry.date;
  }
  return newest;
}

/**
 * How fast the player's OR grows, or null without enough history: on skills
 * when there is a skilled window the skill pace accepts and it isn't stale
 * (OR_BASIS_AFTER_DAYS), else on the OR numbers - an unscouted player, or one
 * seen only on his profile since. A stale skilled window still counts when
 * the OR numbers can't be measured.
 */
export function measureOrGain(entries: readonly OrHistoryEntry[], options: OrGainOptions): OrGain | null {
  const onSkills = measureOnSkills(entries, options);
  if (!onSkills) return measureOnOr(entries, options);
  const orOnly = newestOrOnlyDate(entries);
  if (orOnly === null || daysBetween(onSkills.toDate, orOnly) <= OR_BASIS_AFTER_DAYS) return onSkills;
  return measureOnOr(entries, options) ?? onSkills;
}

export interface OrPace extends OrGain {
  /** The player's age at the middle of the window. */
  midAge: number;
  /** The reference's OR gain per season at midAge, or null where there is none. */
  expectedPerSeason: number | null;
  /** perSeason / expectedPerSeason, e.g. 0.66 for 66%. */
  pace: number | null;
}

/** What an OR model measures and projects against. */
export interface OrReferenceRate {
  gain: OrGainOptions;
  /** The player's age on a history date, given his exact age today. */
  ageOn: (date: string, currentExactAge: number) => number;
  /** The 100% OR gain per season at an exact age; null (or not positive) where there is none. */
  expectedSeasonGain: (age: number) => number | null;
  /** How fast players train at an age, relative to the reference ages (1 where there are no factors). */
  agePaceFactor: (age: number) => number;
  /** The reference's rise between two ages, age factors and camp allowance applied. */
  adjustedGainBetween: (fromAge: number, toAge: number, campDaysPerSeason: number) => number;
  /** Projections stop here. */
  maxAge: number;
}

/** Pace and projection against one reference rate: the shared part of every sport's OR model. */
export function createOrModel(reference: OrReferenceRate) {
  const expectedAt = (age: number) => {
    const gain = reference.expectedSeasonGain(age);
    return gain !== null && gain > 0 ? gain : null;
  };

  function measureOrPace(entries: readonly OrHistoryEntry[], currentExactAge: number): OrPace | null {
    const gain = measureOrGain(entries, reference.gain);
    if (!gain) return null;
    const midAge =
      (reference.ageOn(gain.fromDate, currentExactAge) + reference.ageOn(gain.toDate, currentExactAge)) / 2;
    const expectedPerSeason = expectedAt(midAge);
    return {
      ...gain,
      midAge,
      expectedPerSeason,
      pace: expectedPerSeason === null ? null : gain.perSeason / expectedPerSeason,
    };
  }

  /**
   * OR at `targetAge` if the pace holds: today's OR plus the pace, with the age
   * factor it was measured at divided out, times the reference's age-adjusted
   * rise (camps added back on the skills basis), as the skill projection
   * spends its points. Null without a pace or OR, or at or past the target or
   * the max age.
   */
  function projectOr(
    currentOr: number | undefined,
    currentExactAge: number,
    pace: OrPace | null,
    targetAge: number
  ): number | null {
    if (!pace || pace.pace === null || typeof currentOr !== "number" || !(currentOr > 0)) return null;
    if (currentExactAge >= Math.min(targetAge, reference.maxAge)) return null;
    const underlying = Math.max(0, pace.pace) / reference.agePaceFactor(pace.midAge);
    return currentOr + underlying * reference.adjustedGainBetween(currentExactAge, targetAge, pace.campDaysPerSeason);
  }

  /** Chart points: today's OR, then one rounded point per whole age up to `untilAge`. Empty without a pace. */
  function orProjectionPoints(
    currentOr: number | undefined,
    currentExactAge: number,
    pace: OrPace | null,
    untilAge: number
  ): { x: number; y: number }[] {
    if (!pace || pace.pace === null || typeof currentOr !== "number" || !(currentOr > 0)) return [];
    const points = [{ x: currentExactAge, y: currentOr }];
    const endAge = Math.min(untilAge, reference.maxAge);
    for (let age = Math.floor(currentExactAge) + 1; age <= endAge; age++) {
      const y = projectOr(currentOr, currentExactAge, pace, age);
      if (y !== null) points.push({ x: age, y: Math.round(y) });
    }
    return points.length > 1 ? points : [];
  }

  return {
    orAgePaceFactor: reference.agePaceFactor,
    orExpectedSeasonGain: expectedAt,
    measureOrPace,
    projectOr,
    orProjectionPoints,
  };
}

export interface OrModelOptions {
  /** The top-5% OR line (relativeOrReference). */
  line: OrReference;
  /** The 100% OR gain per season by whole age: the line's smoothed gains (soccer: and its squad's decline). */
  slopes: Readonly<Record<number, number>>;
  /**
   * The OR pace's own age factors, measured like the skill model's
   * (scripts/measure-age-factors.ts, METRIC=or): the OR line's shape differs
   * from the rating line's where the rating/OR share still rises, so the skill
   * factors don't carry over (soccer at 15: 1.78 on the base pace, 1.35 on OR).
   */
  agePaceFactors: readonly { fromAge: number; factor: number }[];
}

/**
 * The OR model of hockey and soccer: the sport's growth config with the top-5%
 * OR line as its table, that line's smoothed gains as the 100% rate and the
 * OR pace's own age factors. The camp allowance, pace windows and projection
 * age limit are the skill model's.
 */
export function createOrGrowthModel<TSkills extends Record<string, number>>(
  config: GrowthConfig<TSkills>,
  options: OrModelOptions
) {
  const model = createGrowthModel({
    ...config,
    growthTable: options.line.map((row) => ({ age: row.age, skill: row.or, exp: 0 })),
    referenceSlopeOverrides: options.slopes,
    agePaceFactors: options.agePaceFactors,
  });
  return createOrModel({
    gain: {
      skillNames: config.skillNames,
      daysPerSeason: config.daysPerSeason,
      pace: config.pace,
      camps: config.camps,
      cleaning: config.cleaning,
    },
    ageOn: (date, currentExactAge) => model.historyEntryAge({ date }, currentExactAge),
    expectedSeasonGain: model.expectedSeasonGain,
    agePaceFactor: model.agePaceFactor,
    adjustedGainBetween: model.adjustedCurveGainBetween,
    maxAge: config.projectionMaxAge,
  });
}
