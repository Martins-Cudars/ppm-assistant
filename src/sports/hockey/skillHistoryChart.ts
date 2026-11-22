/**
 * Shared helpers for converting captured skill-history entries into
 * age/value chart points. Used by the single-player growth chart
 * (PlayerGrowthChart.vue) and the Player Report's growth comparison, which
 * draws on the shared src/components/GrowthComparisonChart.vue.
 */

import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { hockeyPlayerProfile } from "@/sports/hockey/playerProfile";
import { calculatePositions } from "@/classes/playerCalculations";
import { hockeyGrowthConfig } from "@/sports/hockey/growthPace";
import type { GrowthMetric } from "@/components/growthMetric";
import { historyChartPoints, overallOrSkillSum } from "@/base/historyDownsample";
import { SkillHistoryEntry } from "@/types/SkillHistory";

/**
 * The player's current age expressed as a fraction, e.g. 18.25 for a
 * player a quarter of the way through their age-18 season.
 *
 * `seasonDay` must come from the game page (getCurrentSeasonDay()) or, on
 * extension pages that have no game DOM, from playerStore.currentSeasonDay.
 */
export function getExactAge(player: HockeyPlayer, seasonDay: number): number {
  return player.age + seasonDay / hockeyPlayerProfile.daysPerSeason;
}

/**
 * Converts an entry's calendar date into an approximate age at that date by
 * assuming real calendar days and in-game season days advance 1:1, since
 * there's no per-historical-day season day value available to compute this
 * exactly.
 */
export function historyEntryAge(
  entry: SkillHistoryEntry,
  currentExactAge: number
): number {
  const daysAgo =
    (Date.now() - Date.parse(`${entry.date}T00:00:00`)) / 86_400_000;

  return currentExactAge - daysAgo / hockeyPlayerProfile.daysPerSeason;
}

/**
 * The entry's overall rating, tolerating entries written before `kr` was
 * renamed to `overallRating`. Returns null when the entry carries neither -
 * e.g. a training-progress row captured before profiles were tracked.
 */
export function readEntryOverallRating(entry: SkillHistoryEntry): number | null {
  const value = entry.overallRating ?? entry.kr;

  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

/**
 * The entry's best positional "Base" (no-XP) rating. Only the Base rating can
 * be reconstructed for historical days, since neither capture path records a
 * per-day experience value.
 *
 * Returns null for entries with no skills attached - an unscouted player's
 * profile yields an overall rating but no attributes.
 */
export function readEntryBaseRating(entry: SkillHistoryEntry): number | null {
  if (!entry.skills) return null;

  const positions = calculatePositions(
    entry.skills,
    hockeyPlayerProfile.positionSettings,
    0,
    hockeyPlayerProfile.bonusCapRatio ?? 1
  );

  return Math.max(...positions.map((p) => p.ratingWithBonus));
}

/**
 * The entry's overall rating, or the sum of its floored skills when only a
 * full set of skills was stored (overallOrSkillSum). Null when it has neither.
 */
export function entryOverallRating(entry: SkillHistoryEntry): number | null {
  return overallOrSkillSum(readEntryOverallRating(entry), entry.skills, hockeyGrowthConfig.skillNames);
}

/** One player's history as age points for a metric (historyChartPoints). */
export function historyPoints(
  entries: SkillHistoryEntry[],
  currentExactAge: number,
  metric: GrowthMetric
): { x: number; y: number }[] {
  return historyChartPoints(
    entries,
    metric === "or" ? entryOverallRating : readEntryBaseRating,
    (entry) => historyEntryAge(entry, currentExactAge)
  );
}

// Chart thinning is shared with basketball; re-exported so hockey imports keep working.
export { CHART_BUCKET_DAYS, downsampleHistory } from "@/base/historyDownsample";
