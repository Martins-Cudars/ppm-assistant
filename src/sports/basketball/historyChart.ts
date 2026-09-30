/**
 * Chart data for basketball growth: the profile chart and the report's growth
 * comparison. Pure functions - the components only load data and draw.
 *
 * Ratings here are best-position ratings WITHOUT XP, computed from each day's
 * own skills and height (the height modifier matters while a junior grows).
 * Daily history carries no XP, so a past day's rating with XP can't be rebuilt.
 */

import { BasketballSkills } from "@/sports/basketball/classes/BasketballPlayer";
import { downsampleHistory } from "@/base/historyDownsample";
import { basketballPlayerProfile } from "@/sports/basketball/playerProfile";
import {
  BasketballPace,
  REFERENCE_FIRST_AGE,
  REFERENCE_LAST_AGE,
  ReferenceCurve,
  basketballOverall,
  bestBasketballPosition,
  entryAge,
  projectBasketball,
} from "@/sports/basketball/growthModel";

export type Point = { x: number; y: number };
export type GrowthMetric = "skill" | "or";

type ChartEntry = {
  playerId: string;
  date: string;
  skills?: BasketballSkills;
  height?: number;
  overallRating?: number;
};

/** Best-position rating (no XP) for a day, using that day's height when stored. */
export function entryBestRating(entry: ChartEntry, fallbackHeight: number): number | null {
  if (!entry.skills) return null;
  return bestBasketballPosition(entry.skills, entry.height ?? fallbackHeight).rating;
}

/** The day's overall rating, or the sum of floored skills when only skills were stored. */
export function entryOverall(entry: ChartEntry): number | null {
  if (typeof entry.overallRating === "number" && Number.isFinite(entry.overallRating)) {
    return entry.overallRating;
  }
  return entry.skills ? basketballOverall(entry.skills) : null;
}

const readMetric = (entry: ChartEntry, metric: GrowthMetric, fallbackHeight: number) =>
  metric === "or" ? entryOverall(entry) : entryBestRating(entry, fallbackHeight);

/**
 * One player's history as age points, thinned to about one per two weeks.
 * Entries without a value on the metric are dropped BEFORE thinning, so an
 * OR-only day can't swallow a window that had usable skills (the same rule as
 * hockey's comparison chart).
 */
export function historyPoints(
  entries: ChartEntry[],
  currentExactAge: number,
  metric: GrowthMetric,
  fallbackHeight: number,
  today: number = Date.now()
): Point[] {
  const usable = entries.filter((entry) => readMetric(entry, metric, fallbackHeight) !== null);
  return downsampleHistory(usable).map((entry) => ({
    x: entryAge(entry.date, currentExactAge, today),
    y: readMetric(entry, metric, fallbackHeight)!,
  }));
}

/** How far from a whole-age birthday a stored day may be to count for it. */
const AGE_SAMPLE_TOLERANCE_DAYS = 7;

export interface SquadBestCurve {
  /** Per whole age, the highest value any squad player had on reaching it. */
  skill: Point[];
  or: Point[];
}

/**
 * "Your squad's best at each age": for every whole age, the highest rating
 * (and OR) any player had on the day they reached it. The level counterpart of
 * the pace reference - hockey draws a top-player table here, basketball has
 * none, so the user's own best players set the bar and it moves up as better
 * players come through.
 *
 * Sampled at the birthday rather than as a max over the year, so each point
 * means exactly "at age N" and players are compared at the same moment.
 */
export function buildSquadBestCurve(
  historyByPlayer: Map<string, ChartEntry[]>,
  exactAgeByPlayer: Map<string, number>,
  heightByPlayer: Map<string, number>,
  today: number = Date.now()
): SquadBestCurve {
  const best = { skill: new Map<number, number>(), or: new Map<number, number>() };

  historyByPlayer.forEach((entries, playerId) => {
    const exactAge = exactAgeByPlayer.get(playerId);
    if (exactAge === undefined) return;
    const fallbackHeight = heightByPlayer.get(playerId) ?? 0;

    // Nearest stored day to each whole birthday, within the tolerance.
    const nearest = new Map<number, { entry: ChartEntry; distance: number }>();
    entries.forEach((entry) => {
      const age = entryAge(entry.date, exactAge, today);
      const whole = Math.round(age);
      const distance = Math.abs(age - whole) * basketballPlayerProfile.daysPerSeason;
      if (distance > AGE_SAMPLE_TOLERANCE_DAYS) return;
      const held = nearest.get(whole);
      if (!held || distance < held.distance) nearest.set(whole, { entry, distance });
    });

    nearest.forEach(({ entry }, age) => {
      if (age < REFERENCE_FIRST_AGE || age > REFERENCE_LAST_AGE) return;
      const skill = entryBestRating(entry, fallbackHeight);
      const or = entryOverall(entry);
      if (skill !== null && skill > (best.skill.get(age) ?? -Infinity)) best.skill.set(age, skill);
      if (or !== null && or > (best.or.get(age) ?? -Infinity)) best.or.set(age, or);
    });
  });

  const toPoints = (values: Map<number, number>) =>
    [...values.entries()].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y }));
  return { skill: toPoints(best.skill), or: toPoints(best.or) };
}

/**
 * The projection line: today's best-position rating (no XP), then one point
 * per whole age at the player's own pace, as the @25 column computes it. The
 * position may change along the way as a junior grows. Empty without a pace.
 */
export function projectionPoints(
  skills: BasketballSkills | undefined,
  height: number,
  currentExactAge: number,
  pace: BasketballPace | null,
  curve: ReferenceCurve,
  untilAge: number
): Point[] {
  if (!skills || !pace || pace.pace === null) return [];
  const points: Point[] = [
    { x: currentExactAge, y: bestBasketballPosition(skills, height).rating },
  ];
  const endAge = Math.min(untilAge, REFERENCE_LAST_AGE + 1);
  for (let age = Math.floor(currentExactAge) + 1; age <= endAge; age++) {
    const projection = projectBasketball(skills, height, currentExactAge, pace, curve, age);
    if (projection) points.push({ x: age, y: projection.rating });
  }
  return points.length > 1 ? points : [];
}
