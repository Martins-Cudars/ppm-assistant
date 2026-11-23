/**
 * Chart data for soccer growth: the report's growth comparison now, the
 * profile chart in phase 4. Pure functions - components only load and draw.
 *
 * Ratings are best-position ratings with bonus and without XP, from each
 * day's own skills - daily history has no XP, so a past day's rating with XP
 * can't be rebuilt. Same convention as hockey's history charts.
 */

import { SoccerSkills } from "@/sports/soccer/classes/SoccerPlayer";
import { soccerPlayerProfile } from "@/sports/soccer/playerProfile";
import { relativeSkillReference } from "@/sports/soccer/relativeSkillReference";
import { calculatePositions } from "@/classes/playerCalculations";
import type { GrowthMetric } from "@/components/growthMetric";
import { historyChartPoints, overallOrSkillSum } from "@/base/historyDownsample";
import { soccerGrowthConfig } from "@/sports/soccer/growthPace";

export type Point = { x: number; y: number };
export type { GrowthMetric };

type ChartEntry = { date: string; skills?: SoccerSkills; overallRating?: number };

/** Best position's rating with bonus, no XP, for a set of skills. */
export function soccerBestRating(skills: SoccerSkills): number {
  return Math.max(
    ...calculatePositions(
      skills,
      soccerPlayerProfile.positionSettings,
      0,
      soccerPlayerProfile.bonusCapRatio ?? 1
    ).map((position) => position.ratingWithBonus)
  );
}

/** The day's OR, or the sum of its floored skills when only a full set was stored (overallOrSkillSum). */
export function soccerEntryOverall(entry: ChartEntry): number | null {
  return overallOrSkillSum(entry.overallRating, entry.skills, soccerGrowthConfig.skillNames);
}

/** Age on an entry's date, counting a season as 112 calendar days. */
export function soccerEntryAge(date: string, currentExactAge: number, today: number = Date.now()): number {
  const daysAgo = (today - Date.parse(`${date}T00:00:00`)) / 86_400_000;
  return currentExactAge - daysAgo / soccerPlayerProfile.daysPerSeason;
}

const readMetric = (entry: ChartEntry, metric: GrowthMetric) =>
  metric === "or" ? soccerEntryOverall(entry) : entry.skills ? soccerBestRating(entry.skills) : null;

/** One player's history as age points for a metric (historyChartPoints). */
export function soccerHistoryPoints(
  entries: ChartEntry[],
  currentExactAge: number,
  metric: GrowthMetric,
  today: number = Date.now()
): Point[] {
  return historyChartPoints(
    entries,
    (entry) => readMetric(entry, metric),
    (entry) => soccerEntryAge(entry.date, currentExactAge, today)
  );
}

/**
 * The top-5% line's rating (no XP) by age - the grey reference line, the same
 * line relative skill's global 100% is read from.
 */
export const topPlayerSkillCurve: Point[] = relativeSkillReference.map((row) => ({
  x: row.age,
  y: row.skill,
}));
