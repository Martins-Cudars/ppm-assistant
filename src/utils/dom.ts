import { extractTeamIdFromUrl } from "./parsers";

/**
 * DOM parsing utilities that work across all sports
 * These functions query the DOM and extract data from page elements
 */

/**
 * Extract current season day from top info bar
 * Works for all sports - DOM structure is consistent
 *
 * @returns Current season day (1-112) or 1 if not found
 */
export function getCurrentSeasonDay(): number {
  const topInfoDiv = document.querySelector(".top_info_team");
  if (!topInfoDiv) return 1;

  const linkElements = topInfoDiv.querySelectorAll(".link_r");
  for (const link of linkElements) {
    const match = link.textContent?.match(/(\d+)\//);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return 1;
}

/**
 * Get the logged-in user's team ID from navigation
 * Works across all sports
 *
 * @returns Team ID string or "unknown" if not found
 */
export function getUserTeamId(): string {
  // Try top info bar first
  const topInfoDiv = document.querySelector(".top_info_team");
  if (topInfoDiv) {
    const teamLink = topInfoDiv.querySelector("a[href*='komanda.html']");
    if (teamLink) {
      const teamId = extractTeamIdFromUrl(teamLink.getAttribute("href") || "");
      if (teamId) return teamId;
    }
  }

  // Fallback to navigation links
  const navLinks = document.querySelectorAll("a[href*='komanda.html']");
  for (const link of navLinks) {
    const teamId = extractTeamIdFromUrl(link.getAttribute("href") || "");
    if (teamId) return teamId;
  }

  return "unknown";
}

/**
 * Get team ID from player profile page
 * Looks for team link within player info section
 *
 * @returns Team ID string or "unknown" if not found
 */
export function getPlayerTeamId(): string {
  const playerInfoDiv = document.querySelector(".player_info");
  if (!playerInfoDiv) return "unknown";

  const teamLink = playerInfoDiv.querySelector("a[href*='komanda.html']");
  if (teamLink) {
    const teamId = extractTeamIdFromUrl(teamLink.getAttribute("href") || "");
    if (teamId) return teamId;
  }

  return "unknown";
}

/**
 * Get the viewed player's team name from player profile page
 * Reads the team link inside .player_info — this is the player's actual team,
 * which may differ from the logged-in user's team.
 *
 * @returns Team name string or "unknown" if not found
 */
export function getTeamNameFromPlayerProfile(): string {
  const playerInfoDiv = document.querySelector(".player_info");
  if (!playerInfoDiv) return "unknown";

  const teamLink = playerInfoDiv.querySelector("a[href*='komanda.html']");
  return teamLink?.textContent?.trim() || "unknown";
}

/**
 * Get the logged-in user's team name from the top info bar
 * Works on any page including the user's player list.
 *
 * @returns Team name string or "unknown" if not found
 */
export function getTeamNameFromUserPlayerList(): string {
  const topInfoDiv = document.querySelector(".top_info_team");
  if (!topInfoDiv) return "unknown";

  const teamLink = topInfoDiv.querySelector("a[href*='komanda.html']");
  return teamLink?.textContent?.trim() || "unknown";
}
