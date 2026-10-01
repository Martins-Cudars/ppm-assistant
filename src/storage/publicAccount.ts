/**
 * The game's "Public account": the shared demo team PPM shows when nobody is
 * logged in (team.html?data=3323-public-account in basketball, "Public
 * Account" 5289 in hockey). It even has a "Log out" link, so login state
 * can't tell it apart - only the team can.
 *
 * Before this was handled the extension cached the demo squad as if it were
 * the user's, and the Player Report (which read the first team cache it found)
 * showed the 15 demo players instead of the user's own.
 *
 * Pure functions, no DOM: shared by the content script, the report page and
 * the background worker's cleanup.
 */

import { Sport } from "@/types/Sport";
import { teamPrefix } from "@/storage/cacheKeys";

/** Known public-account team ids - a backstop in case the slug or name is localised. */
export const PUBLIC_ACCOUNT_TEAM_IDS: Readonly<Record<Sport, string>> = {
  hockey: "5289",
  basketball: "3323",
};

/** Whether a header team link (href + visible name) is the public account's. */
export function isPublicAccountLink(href: string, name: string, sport: Sport | null): boolean {
  if (/public-account/i.test(href)) return true;
  if (/^public account$/i.test(name.trim())) return true;
  const id = href.match(/data=(\d+)/)?.[1];
  return sport !== null && id === PUBLIC_ACCOUNT_TEAM_IDS[sport];
}

type CacheLike = {
  teamId?: string;
  lastModified?: string;
  squad?: { updatedAt?: string } | null;
  players?: Record<string, { baseInfo?: { teamName?: string; teamId?: string } }>;
};

const teamIdOfKey = (key: string, sport: Sport) => key.slice(teamPrefix(sport).length);

/**
 * Whether a stored team cache is the public account's: by its team id, or -
 * for a public account whose id isn't listed - by its players' team name.
 */
export function isPublicAccountCache(key: string, cache: CacheLike | undefined, sport: Sport): boolean {
  if (teamIdOfKey(key, sport) === PUBLIC_ACCOUNT_TEAM_IDS[sport]) return true;
  const players = Object.values(cache?.players ?? {});
  return (
    players.length > 0 &&
    players.every((player) => /^public account$/i.test((player.baseInfo?.teamName ?? "").trim()))
  );
}

/** Every public-account team cache key of a sport in storage. */
export function publicAccountCacheKeys(allData: Record<string, unknown>, sport: Sport): string[] {
  return Object.keys(allData).filter(
    (key) =>
      key.startsWith(teamPrefix(sport)) &&
      isPublicAccountCache(key, allData[key] as CacheLike | undefined, sport)
  );
}

/**
 * The user's team cache for a sport, for extension pages (no game DOM to ask).
 * Skips "unknown" and public-account caches, then takes the one whose squad
 * overview was saved most recently (falling back to its last write) - right
 * for a user with two accounts too, rather than whichever key sorts first.
 */
export function pickTeamCacheKey(allData: Record<string, unknown>, sport: Sport): string | null {
  const stamp = (key: string) => {
    const cache = allData[key] as CacheLike | undefined;
    return Date.parse(cache?.squad?.updatedAt ?? cache?.lastModified ?? "") || 0;
  };
  const candidates = Object.keys(allData).filter(
    (key) =>
      key.startsWith(teamPrefix(sport)) &&
      !key.includes("unknown") &&
      !isPublicAccountCache(key, allData[key] as CacheLike | undefined, sport)
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, key) => (stamp(key) > stamp(best) ? key : best));
}
