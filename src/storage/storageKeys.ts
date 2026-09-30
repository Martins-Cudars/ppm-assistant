/**
 * Storage key utilities for managing localStorage keys
 * Handles team ID detection and season change detection
 */

import { getUserTeamId } from "@/utils/dom";
import { SPORTS, Sport } from "@/types/Sport";

/**
 * Generates the storage key for the current team's player cache.
 * Format: ppm-assistant:{sport}:team-{teamId} - hockey's key is unchanged.
 */
export function generateStorageKey(sport: Sport = "hockey"): string {
  const teamId = getUserTeamId();
  return `${teamPrefix(sport)}${teamId}`;
}

/** The prefix every team cache key of a sport shares. */
export function teamPrefix(sport: Sport): string {
  return `ppm-assistant:${sport}:team-`;
}

/** Whether a storage key is any sport's team cache. */
export function isTeamCacheKey(key: string): boolean {
  return SPORTS.some((sport) => key.startsWith(teamPrefix(sport)));
}

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
