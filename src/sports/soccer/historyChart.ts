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
import { playerGrowthPrediction } from "@/sports/soccer/settings";
import { calculatePositions } from "@/classes/playerCalculations";
import { downsampleHistory } from "@/base/historyDownsample";

export type Point = { x: number; y: number };
export type GrowthMetric = "skill" | "or";

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

/** The day's OR, or the sum of floored skills when only skills were stored. */
export function soccerEntryOverall(entry: ChartEntry): number | null {
  if (typeof entry.overallRating === "number" && Number.isFinite(entry.overallRating)) {
    return entry.overallRating;
  }
  return entry.skills
    ? Object.values(entry.skills).reduce((sum, value) => sum + Math.floor(value), 0)
    : null;
}

/** Age on an entry's date, counting a season as 112 calendar days. */
export function soccerEntryAge(date: string, currentExactAge: number, today: number = Date.now()): number {
  const daysAgo = (today - Date.parse(`${date}T00:00:00`)) / 86_400_000;
  return currentExactAge - daysAgo / soccerPlayerProfile.daysPerSeason;
}

const readMetric = (entry: ChartEntry, metric: GrowthMetric) =>
  metric === "or" ? soccerEntryOverall(entry) : entry.skills ? soccerBestRating(entry.skills) : null;

/**
 * One player's history as age points, thinned to about one per two weeks.
 * Entries without a value on the metric are dropped BEFORE thinning, so an
 * OR-only day can't swallow a window that had usable skills.
 */
export function soccerHistoryPoints(
  entries: ChartEntry[],
  currentExactAge: number,
  metric: GrowthMetric,
  today: number = Date.now()
): Point[] {
  const usable = entries.filter((entry) => readMetric(entry, metric) !== null);
  return downsampleHistory(usable).map((entry) => ({
    x: soccerEntryAge(entry.date, currentExactAge, today),
    y: readMetric(entry, metric)!,
  }));
}

/** The top-player table's rating (no XP) by age - the grey reference line. */
export const topPlayerSkillCurve: Point[] = playerGrowthPrediction.map((row) => ({
  x: row.age,
  y: row.skill,
}));
