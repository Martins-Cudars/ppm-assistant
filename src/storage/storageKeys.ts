/**
 * Storage key utilities for managing localStorage keys
 * Handles team ID detection and season change detection
 */

/**
 * Extracts team ID from the current page's top navigation
 * Tries multiple selectors to find the user's team link
 * @returns Team ID string or "unknown" if not found
 */
export function getTeamId(): string {
  // Try the top_info_team link first (most common)
  let teamLink = document.querySelector(".top_info_team a[href*='team']") as HTMLAnchorElement;

  // If not found, try the main navigation team link
  if (!teamLink) {
    teamLink = document.querySelector("a[href*='komanda.html'], a[href*='team.html']") as HTMLAnchorElement;
  }

  // If still not found, try any team link in the header/navigation
  if (!teamLink) {
    teamLink = document.querySelector(".top_bar a[href*='data='], .navigation a[href*='komanda']") as HTMLAnchorElement;
  }

  if (!teamLink) {
    console.warn("[StorageKeys] Could not find team ID in page. Team link not found.");
    return "unknown";
  }

  const match = teamLink.href.match(/data=(\d+)/);
  if (!match) {
    console.warn("[StorageKeys] Could not extract team ID from URL:", teamLink.href);
    return "unknown";
  }

  const teamId = match[1];
  console.log("[StorageKeys] Extracted team ID:", teamId);
  return teamId;
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
