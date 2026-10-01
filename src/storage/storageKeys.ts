/**
 * Storage key utilities for managing localStorage keys
 * Handles team ID detection and season change detection
 */

import { getUserTeamId } from "@/utils/dom";
import { Sport } from "@/types/Sport";
import { teamPrefix } from "./cacheKeys";

/**
 * Generates the storage key for the current team's player cache.
 * Format: ppm-assistant:{sport}:team-{teamId} - hockey's key is unchanged.
 */
export function generateStorageKey(sport: Sport = "hockey"): string {
  const teamId = getUserTeamId();
  return `${teamPrefix(sport)}${teamId}`;
}

// Key shapes live in cacheKeys.ts (no dependencies); re-exported for existing imports.
export { isTeamCacheKey, teamPrefix } from "./cacheKeys";

/**
 * Detects if a new season has started based on season day values
 * Season rollover: current day is near start (< 5) and cached is near end (> 100)
 * @param cachedSeasonDay - Season day from cached data
 * @param currentSeasonDay - Current season day
 * @returns True if a new season has started
 */
export function isNewSeason(cachedSeasonDay: number, currentSeasonDay: number): boolean {
  return currentSeasonDay < 5 && cachedSeasonDay > 100;
}
