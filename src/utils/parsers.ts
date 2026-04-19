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

/**
 * Extract the language code from a PPM page pathname
 * @param pathname - window.location.pathname, e.g. "/lv/player.html"
 * @returns Two-letter language code, or "en" if not found
 *
 * @example
 * extractLangFromUrl("/lv/player.html")  // Returns: "lv"
 * extractLangFromUrl("/en/player.html")  // Returns: "en"
 */
export function extractLangFromUrl(pathname: string): string {
  const match = pathname.match(/^\/([a-z]{2})\//);
  return match ? match[1] : "en";
}

/**
 * Build a full PPM player profile URL
 * @param sport - Sport subdomain: "hockey" | "soccer" | "basketball"
 * @param lang - Language code, e.g. "lv" or "en"
 * @param playerPage - Language-specific page filename, e.g. "speletajs.html" or "player.html"
 * @param playerId - Player ID
 * @returns Full URL to the player's profile page
 *
 * @example
 * buildPlayerProfileUrl("hockey", "lv", "speletajs.html", "12345")
 * // Returns: "https://hockey.powerplaymanager.com/lv/speletajs.html?data=12345"
 */
export function buildPlayerProfileUrl(sport: string, lang: string, playerPage: string, playerId: string): string {
  return `https://${sport}.powerplaymanager.com/${lang}/${playerPage}?data=${playerId}`;
}
