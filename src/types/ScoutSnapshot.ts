/**
 * Scouted roster data: what another team's "Players" page shows about each of
 * its players on the day it was opened. Kept in its own object store per sport
 * (src/background.ts), apart from the skill history - that store is the user's
 * own squad, day by day, and everything reading it (reports, summaries, the
 * basketball reference curve) assumes so.
 *
 * A roster page has no skills, so a snapshot is OR plus what explains it.
 */

import { Sport } from "@/types/Sport";

/**
 * Where a snapshot came from: another team's roster page, or the user's own
 * squad overview (so the user's players are in the reference too).
 */
export type ScoutSnapshotSource = "TeamRoster" | "PlayersList";

export interface ScoutSnapshot {
  id: string; // `${playerId}:${date}`, as in the skill history
  playerId: string;
  date: string; // ISO "YYYY-MM-DD", local
  name?: string;
  /**
   * Stored with every snapshot rather than looked up later: players change
   * teams and age, and "who was in my league" is asked of the day it was seen.
   */
  teamId?: string;
  teamName?: string;
  /** Whole years, as the game shows it. */
  age?: number;
  season?: number;
  seasonDay?: number;
  overallRating?: number;
  height?: number;
  /** "AvQ": the average of the player's training qualities. */
  averageQuality?: number;
  /** "CL": seasons of career left, 0-6. */
  careerLongevity?: number;
  capturedAt: string; // ISO timestamp
  source: ScoutSnapshotSource;
}

/** The teams of the user's league, as last read from the league page. */
export interface LeagueTeams {
  /** Season the list was read in - the league can change every season. */
  season: number;
  /** `${country}-${level}-${number}`, e.g. "lva-iii-3": which league this is. */
  leagueId: string;
  /** For display, e.g. "III.3 (Latvia)". */
  leagueName: string;
  teamIds: string[];
  updatedAt: string; // ISO timestamp
}

/** The scout-snapshot object store for a sport. */
export function scoutStoreName(sport: Sport): string {
  return `scoutSnapshots_${sport}`;
}

/** chrome.storage.local key of a sport's league list. */
export function leagueStorageKey(sport: Sport): string {
  return `ppm-assistant:${sport}:league`;
}
