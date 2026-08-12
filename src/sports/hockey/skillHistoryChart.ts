/**
 * Shared helpers for converting captured skill-history entries into
 * age/skill chart points. Used by both the single-player growth chart
 * (PlayerGrowthChart.vue) and the multi-player comparison chart
 * (PlayerGrowthComparisonChart.vue).
 */

import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { hockeyPlayerProfile } from "@/sports/hockey/playerProfile";
import { calculatePositions } from "@/classes/playerCalculations";
import { SkillHistoryEntry } from "@/types/SkillHistory";

/**
 * The player's current age expressed as a fraction, e.g. 18.25 for a
 * player a quarter of the way through their age-18 season.
 */
export function getExactAge(player: HockeyPlayer, seasonDay: number): number {
  return player.age + seasonDay / hockeyPlayerProfile.daysPerSeason;
}

/**
 * Converts a single history entry into a chart point. Only the "Base"
 * (no-XP) rating can be reconstructed exactly for historical days, since
 * the history table doesn't capture a per-day experience value.
 *
 * Converts the entry's calendar date into an approximate age at that date
 * by assuming real calendar days and in-game season days advance 1:1,
 * since there's no per-historical-day season day value available to
 * compute this exactly.
 */
export function historyEntryToAgePoint(
  entry: SkillHistoryEntry,
  currentExactAge: number
): { x: number; y: number } {
  const positions = calculatePositions(
    entry.skills,
    hockeyPlayerProfile.positionSettings,
    0,
    hockeyPlayerProfile.bonusCapRatio ?? 1
  );
  const bestRating = Math.max(...positions.map((p) => p.ratingWithBonus));

  const daysAgo =
    (Date.now() - Date.parse(`${entry.date}T00:00:00`)) / 86_400_000;
  const ageAtEntry = currentExactAge - daysAgo / hockeyPlayerProfile.daysPerSeason;

  return { x: ageAtEntry, y: bestRating };
}
