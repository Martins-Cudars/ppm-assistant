/**
 * String and URL parsing utilities
 * Pure functions with no DOM dependencies
 */

/**
 * Extract team ID from a URL containing data= parameter
 * @param url - URL string to parse
 * @returns Team ID or null if not found
 *
 * @example
 * extractTeamIdFromUrl("komanda.html?data=129853-hc-skanste")
 * // Returns: "129853"
 */
export function extractTeamIdFromUrl(url: string): string | null {
  const match = url.match(/data=(\d+)/);
  return match ? match[1] : null;
}
