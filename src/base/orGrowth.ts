/**
 * OR pace and the OR projection: the OR counterpart of the skill pace in
 * src/base/growthModel.ts, for the profile charts' OR view. Pure functions.
 *
 * How fast a player's OR grows is measured from his history in one of two
 * ways (measureOrGain):
 *
 * - **On skills**, when his history has skills: the same window and the same
 *   cleaning as the skill pace (no-training and camp days skipped, see
 *   src/base/gainCleaning.ts), counting every skill's points. OR is the sum of
 *   the floored skills, so its growth is the skill points per season.
 * - **On the OR numbers**, when it has none (an unscouted player, whose
 *   profile shows only his OR): end to end over the same window. OR is a
 *   whole number and these days come from occasional profile visits, so no
 *   day can be judged as a camp or a no-training day; the rate is the
 *   calendar rate with whatever camps fell in the window, and the projection
 *   adds no camp allowance on top.
 *
 * Hockey and soccer measure that rate against the top-5% OR line
 * (relativeOrReference, the fit's OR percentile before the rating share):
 * pace = OR per season / the line's smoothed season gain at the window's
 * middle age, as the skill pace reads the top-5% rating line. Basketball reads
 * its squad reference instead (src/sports/basketball/growthModel.ts), as its
 * skill pace does.
 */

import { CleaningOptions, cleanedGains, daysBetween } from "@/base/gainCleaning";
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

type Row = { date: string; source?: string; skills: Record<string, number> };

const byDate = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date);

/** The window: from the first row within windowDays of the last. Null with fewer than two. */
function windowOf<T extends { date: string }>(rows: T[], windowDays: number): T[] | null {
  if (rows.length < 2) return null;
  const last = rows[rows.length - 1];
  const start = rows.findIndex((row) => daysBetween(row.date, last.date) <= windowDays);
  return start >= 0 && start < rows.length - 1 ? rows.slice(start) : null;
}

/** The skill pace's measurement, every skill counted: rows with skills only. */
function measureOnSkills(entries: OrHistoryEntry[], options: OrGainOptions): OrGain | null {
  const usable = entries
    .filter((entry): entry is OrHistoryEntry & { skills: object } => !!entry.skills)
    .map((entry): Row => ({ date: entry.date, source: entry.source, skills: entry.skills as Record<string, number> }))
    .sort(byDate);
  const window = windowOf(usable, options.pace.windowDays);
  if (!window) return null;

  const first = window[0];
  const last = window[window.length - 1];
  const spanDays = daysBetween(first.date, last.date);
  const cleaned = cleanedGains(window, options.skillNames, spanDays, options.cleaning);
  if (cleaned.measuredDays < options.pace.provisionalMinDays) return null;

  // The camp record, as the skill pace reads it: a season back, or the full
  // allowance until there is a season of history.
  const seasonStart = usable.find((row) => daysBetween(row.date, last.date) <= options.camps.lookbackDays)!;
  const campDaysAssumed = daysBetween(usable[0].date, last.date) < options.camps.lookbackDays;
  const campDaysPerSeason = campDaysAssumed
    ? options.camps.maxDaysPerSeason
    : Math.min(
        options.camps.maxDaysPerSeason,
        cleanedGains(
          usable.slice(usable.indexOf(seasonStart)),
          options.skillNames,
          daysBetween(seasonStart.date, last.date),
          options.cleaning
        ).skippedCampDays
      );

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
    campDaysPerSeason,
    campDaysAssumed,
  };
}

/** The OR numbers end to end: every row with an OR (overallOrSkillSum). */
function measureOnOr(entries: OrHistoryEntry[], options: OrGainOptions): OrGain | null {
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
    .sort(byDate);
  const window = windowOf(usable, options.pace.windowDays);
  if (!window) return null;

  const first = window[0];
  const last = window[window.length - 1];
  const spanDays = daysBetween(first.date, last.date);
  if (spanDays < options.pace.provisionalMinDays) return null;

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
 * How fast the player's OR grows, or null without enough history. Measured on
 * skills where the history has them, else on the OR numbers; when both can
 * be measured, the one with the more recent last day wins (skills on a tie),
 * so an own player who has since moved and is only seen on his profile is
 * read from his recent days.
 */
export function measureOrGain(entries: OrHistoryEntry[], options: OrGainOptions): OrGain | null {
  const onSkills = measureOnSkills(entries, options);
  const onOr = measureOnOr(entries, options);
  if (!onSkills || !onOr) return onSkills ?? onOr;
  return onOr.toDate > onSkills.toDate ? onOr : onSkills;
}

export interface OrPace extends OrGain {
  /** The player's age at the middle of the window. */
  midAge: number;
  /** The top-5% OR line's smoothed gain per season at midAge, or null where there is none. */
  expectedPerSeason: number | null;
  /** perSeason / expectedPerSeason, e.g. 0.66 for 66%. */
  pace: number | null;
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
   * factors don't carry over (soccer at 15: 1.78 on the base pace, 1.28 on OR).
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

  function measureOrPace(entries: OrHistoryEntry[], currentExactAge: number): OrPace | null {
    const gain = measureOrGain(entries, {
      skillNames: config.skillNames,
      daysPerSeason: config.daysPerSeason,
      pace: config.pace,
      camps: config.camps,
      cleaning: config.cleaning,
    });
    if (!gain) return null;
    const midAge =
      (model.historyEntryAge({ date: gain.fromDate }, currentExactAge) +
        model.historyEntryAge({ date: gain.toDate }, currentExactAge)) /
      2;
    const expectedPerSeason = model.expectedSeasonGain(midAge);
    return {
      ...gain,
      midAge,
      expectedPerSeason,
      pace: expectedPerSeason === null ? null : gain.perSeason / expectedPerSeason,
    };
  }

  /**
   * OR at `targetAge` if the pace holds: today's OR plus the pace, with the age
   * factor it was measured at divided out, times the line's age-adjusted rise
   * (camps added back on the skills basis), as the skill projection spends
   * its points. Null without a pace or OR, or at or past the target or the
   * max age.
   */
  function projectOr(
    currentOr: number | undefined,
    currentExactAge: number,
    pace: OrPace | null,
    targetAge: number
  ): number | null {
    if (!pace || pace.pace === null || typeof currentOr !== "number" || !(currentOr > 0)) return null;
    if (currentExactAge >= Math.min(targetAge, config.projectionMaxAge)) return null;
    const underlying = Math.max(0, pace.pace) / model.agePaceFactor(pace.midAge);
    return currentOr + underlying * model.adjustedCurveGainBetween(currentExactAge, targetAge, pace.campDaysPerSeason);
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
    const endAge = Math.min(untilAge, config.projectionMaxAge);
    for (let age = Math.floor(currentExactAge) + 1; age <= endAge; age++) {
      const y = projectOr(currentOr, currentExactAge, pace, age);
      if (y !== null) points.push({ x: age, y: Math.round(y) });
    }
    return points.length > 1 ? points : [];
  }

  return {
    orAgePaceFactor: model.agePaceFactor,
    orExpectedSeasonGain: model.expectedSeasonGain,
    measureOrPace,
    projectOr,
    orProjectionPoints,
  };
}
