/**
 * Shared helpers for converting captured skill-history entries into
 * age/value chart points. Used by both the single-player growth chart
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
 * Converts a single history entry into a {x: age, y: base rating} chart point,
 * or null when the entry has no skills to derive a rating from.
 */
export function historyEntryToAgePoint(
  entry: SkillHistoryEntry,
  currentExactAge: number
): { x: number; y: number } | null {
  const bestRating = readEntryBaseRating(entry);
  if (bestRating === null) return null;

  return { x: historyEntryAge(entry, currentExactAge), y: bestRating };
}
