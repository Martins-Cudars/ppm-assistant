/**
 * Pure rules for the scouted data: merging two captures of one player/day, and
 * deciding what a league page changes about the stored league list.
 */

import { LeagueTeams, ScoutSnapshot } from "@/types/ScoutSnapshot";

/**
 * Two captures of the same player on the same day. Incoming values win where
 * present, stored ones survive where the incoming snapshot is silent - the
 * same rule as the skill history's merge.
 */
export function mergeScoutSnapshot(
  existing: ScoutSnapshot | undefined,
  incoming: ScoutSnapshot
): ScoutSnapshot {
  if (!existing) return incoming;
  const present = Object.fromEntries(
    Object.entries(incoming).filter(([, value]) => value !== undefined)
  ) as Partial<ScoutSnapshot>;
  return { ...existing, ...present };
}

/** What a league page shows: which league and season, and the teams in its table. */
export interface LeaguePage {
  season: number;
  leagueId: string;
  leagueName: string;
  teamIds: string[];
  /** No `data` in the URL: the game's default, which is the user's own league. */
  isDefaultPage: boolean;
}

/**
 * The league list after seeing a league page, or null when the page isn't the
 * user's league and so changes nothing.
 *
 * A page counts as the user's league when it is the default league page, when
 * the user's team is in its table, or when it is the league already stored.
 * The second and third matter because one league has several tables: late in a
 * season the default page is the relegation round, which lists half the league
 * and may not include the user at all, while "League standings" lists everyone.
 * So tables of the same league and season add up; a different league or a new
 * season replaces the list - promotion and relegation follow the next visit.
 *
 * A table of any season but the current one changes nothing: the user's team
 * is in last season's table too, and browsing it must not bring back a league
 * they have since left. `currentSeason` is the header's; null when unreadable.
 *
 * The user's own team is always in the list.
 */
export function nextLeagueTeams(
  stored: LeagueTeams | null,
  page: LeaguePage,
  userTeamId: string,
  currentSeason: number | null,
  now: string = new Date().toISOString()
): LeagueTeams | null {
  if (page.teamIds.length === 0) return null;
  if (currentSeason !== null && page.season !== currentSeason) return null;

  const sameLeague =
    stored !== null && stored.leagueId === page.leagueId && stored.season === page.season;
  const isUsersLeague = page.isDefaultPage || page.teamIds.includes(userTeamId) || sameLeague;
  if (!isUsersLeague) return null;

  const teamIds = new Set<string>(sameLeague ? stored!.teamIds : []);
  page.teamIds.forEach((id) => teamIds.add(id));
  teamIds.add(userTeamId);

  return {
    season: page.season,
    leagueId: page.leagueId,
    leagueName: page.leagueName,
    teamIds: [...teamIds],
    updatedAt: now,
  };
}
