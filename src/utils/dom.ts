import { extractTeamIdFromUrl } from "./parsers";
import { isPublicAccountLink } from "@/storage/publicAccount";
import { parseSeasonText } from "@/base/captureUtils";

/**
 * DOM parsing utilities that work across all sports
 * These functions query the DOM and extract data from page elements
 */

/**
 * A link to a team's page, in either language: "komanda.html" on the Latvian
 * site, "team.html" on the English one (e.g. /en/team.html?data=39743-...).
 * Matching only the Latvian name made every English page report the team as
 * "unknown", which silently skipped caching the squad. "/team.html" keeps the
 * slash so "team-news.html" and "team-settings.html" don't match.
 */
const TEAM_LINK = "a[href*='komanda.html'], a[href*='/team.html']";

/**
 * Extract current season day from top info bar
 * Works for all sports - DOM structure is consistent
 *
 * Only usable on powerplaymanager.com pages. It silently returns 1 when the
 * info bar isn't present, which includes every standalone extension page
 * (e.g. player-report.html) - those must read `playerStore.currentSeasonDay`
 * instead, which the cache persists from the last game-page visit. Falling
 * back to 1 there quietly corrupts any age/season maths built on it.
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
 * Season number and day from the top info bar ("Season: 64 (68/70)"), or null
 * when the bar isn't there - e.g. on the extension's own pages.
 */
export function getCurrentSeason(): { season: number; seasonDay: number } | null {
  return parseSeasonText(document.querySelector(".top_info_team")?.textContent ?? "");
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
    const teamLink = topInfoDiv.querySelector(TEAM_LINK);
    if (teamLink) {
      const teamId = extractTeamIdFromUrl(teamLink.getAttribute("href") || "");
      if (teamId) return teamId;
    }
  }

  // Fallback to navigation links
  const navLinks = document.querySelectorAll(TEAM_LINK);
  for (const link of navLinks) {
    const teamId = extractTeamIdFromUrl(link.getAttribute("href") || "");
    if (teamId) return teamId;
  }

  return "unknown";
}

/**
 * Whether this page belongs to the game's logged-out "Public account" demo
 * team (see src/storage/publicAccount.ts). Judged by the header's own-team
 * link, the same one getUserTeamId() reads.
 */
export function isPublicAccount(): boolean {
  const teamLink = document.querySelector(".top_info_team")?.querySelector(TEAM_LINK);
  if (!teamLink) return false;
  const host = window.location.hostname;
  const sport = host.startsWith("hockey.")
    ? "hockey"
    : host.startsWith("basketball.")
      ? "basketball"
      : host.startsWith("soccer.")
        ? "soccer"
        : null;
  return isPublicAccountLink(teamLink.getAttribute("href") ?? "", teamLink.textContent ?? "", sport);
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

  const teamLink = playerInfoDiv.querySelector(TEAM_LINK);
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

  const teamLink = playerInfoDiv.querySelector(TEAM_LINK);
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

  const teamLink = topInfoDiv.querySelector(TEAM_LINK);
  return teamLink?.textContent?.trim() || "unknown";
}
