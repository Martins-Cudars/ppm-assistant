/**
 * Storage key utilities for managing localStorage keys
 * Handles team ID detection and season change detection
 */

/**
 * Extracts team ID from the current page's top navigation
 * @returns Team ID string or "unknown" if not found
 */
export function getTeamId(): string {
  const teamLink = document.querySelector(".top_info_team a[href*='team']") as HTMLAnchorElement;
  const match = teamLink?.href.match(/data=(\d+)/);
  return match ? match[1] : "unknown";
}

/**
 * Generates the localStorage key for the current team
 * Format: ppm-assistant:hockey:team-{teamId}
 * @returns Storage key string
 */
export function generateStorageKey(): string {
  const teamId = getTeamId();
  return `ppm-assistant:hockey:team-${teamId}`;
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
