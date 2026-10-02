/**
 * Client-side API for the scouted roster data (src/types/ScoutSnapshot.ts).
 * The snapshots live in the background worker's IndexedDB, reached by message
 * like the skill history (src/storage/skillHistoryDb.ts); the league list is
 * one small record in chrome.storage.local.
 */

import { LeagueTeams, ScoutSnapshot, leagueStorageKey } from "@/types/ScoutSnapshot";
import { SkillHistoryMessage, SkillHistoryResponse } from "@/types/SkillHistoryMessages";
import { Sport } from "@/types/Sport";

async function send(message: SkillHistoryMessage): Promise<SkillHistoryResponse> {
  return chrome.runtime.sendMessage(message);
}

/** Stores a page's worth of snapshots; same-day repeats merge per field. */
export async function upsertScoutSnapshots(
  snapshots: ScoutSnapshot[],
  sport: Sport
): Promise<{ written: number }> {
  if (snapshots.length === 0) return { written: 0 };
  try {
    const response = await send({ type: "SCOUT_UPSERT", sport, snapshots });
    return { written: response.type === "SCOUT_UPSERT" ? response.written : 0 };
  } catch (error) {
    console.error("[ScoutSnapshotDb] Failed to store snapshots:", error);
    return { written: 0 };
  }
}

/**
 * Every stored snapshot of a sport, or null if the read failed - null rather
 * than [] so a backup never writes "no scouted data" over a failed read.
 */
export async function exportScoutSnapshots(sport: Sport): Promise<ScoutSnapshot[] | null> {
  try {
    const response = await send({ type: "SCOUT_EXPORT", sport });
    return response.type === "SCOUT_EXPORT" ? response.snapshots : null;
  } catch (error) {
    console.error("[ScoutSnapshotDb] Failed to read snapshots:", error);
    return null;
  }
}

/** Empties a sport's snapshots; the number removed, or null if it failed. */
export async function clearScoutSnapshots(sport: Sport): Promise<number | null> {
  try {
    const response = await send({ type: "SCOUT_CLEAR", sport });
    return response.type === "SCOUT_CLEAR" ? response.cleared : null;
  } catch (error) {
    console.error("[ScoutSnapshotDb] Failed to clear snapshots:", error);
    return null;
  }
}

function isLeagueTeams(value: unknown): value is LeagueTeams {
  if (typeof value !== "object" || value === null) return false;
  const league = value as Partial<LeagueTeams>;
  return (
    typeof league.season === "number" &&
    typeof league.leagueId === "string" &&
    Array.isArray(league.teamIds) &&
    league.teamIds.every((id) => typeof id === "string")
  );
}

/** A candidate league list (e.g. from a backup file), or null when it isn't one. */
export function validLeagueTeams(value: unknown): LeagueTeams | null {
  if (!isLeagueTeams(value)) return null;
  return {
    season: value.season,
    leagueId: value.leagueId,
    leagueName: typeof value.leagueName === "string" ? value.leagueName : value.leagueId,
    teamIds: value.teamIds,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
  };
}

/** The stored league list of a sport, or null when none was saved yet. */
export async function readLeagueTeams(sport: Sport): Promise<LeagueTeams | null> {
  try {
    const key = leagueStorageKey(sport);
    const data = await chrome.storage.local.get(key);
    return validLeagueTeams(data[key]);
  } catch (error) {
    console.error("[ScoutSnapshotDb] Failed to read the league list:", error);
    return null;
  }
}

export async function saveLeagueTeams(league: LeagueTeams, sport: Sport): Promise<void> {
  await chrome.storage.local.set({ [leagueStorageKey(sport)]: league });
}

export async function clearLeagueTeams(sport: Sport): Promise<void> {
  await chrome.storage.local.remove(leagueStorageKey(sport));
}
