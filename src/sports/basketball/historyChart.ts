/**
 * Chart data for basketball growth: the profile chart and the report's growth
 * comparison. Pure functions - the components only load data and draw.
 *
 * Ratings here are best-position ratings WITHOUT XP, computed from each day's
 * own skills and height (the height modifier matters while a junior grows).
 * Daily history carries no XP, so a past day's rating with XP can't be rebuilt.
 */

import { BasketballSkills } from "@/sports/basketball/classes/BasketballPlayer";
import type { GrowthMetric } from "@/components/growthMetric";
import { historyChartPoints, overallOrSkillSum } from "@/base/historyDownsample";
import {
  BasketballPace,
  REFERENCE_LAST_AGE,
  BASKETBALL_SKILLS,
  ReferenceCurve,
  bestBasketballPosition,
  entryAge,
  projectBasketball,
} from "@/sports/basketball/growthModel";

export type Point = { x: number; y: number };
export type { GrowthMetric };

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

/** The day's OR, or the sum of its floored skills when only a full set was stored (overallOrSkillSum). */
export function entryOverall(entry: ChartEntry): number | null {
  return overallOrSkillSum(entry.overallRating, entry.skills, BASKETBALL_SKILLS);
}

const readMetric = (entry: ChartEntry, metric: GrowthMetric, fallbackHeight: number) =>
  metric === "or" ? entryOverall(entry) : entryBestRating(entry, fallbackHeight);

/** One player's history as age points for a metric (historyChartPoints). */
export function historyPoints(
  entries: ChartEntry[],
  currentExactAge: number,
  metric: GrowthMetric,
  fallbackHeight: number,
  today: number = Date.now()
): Point[] {
  return historyChartPoints(
    entries,
    (entry) => readMetric(entry, metric, fallbackHeight),
    (entry) => entryAge(entry.date, currentExactAge, today)
  );
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
