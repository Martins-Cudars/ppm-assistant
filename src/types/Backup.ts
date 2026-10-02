/**
 * Shape of the backup file the Player Report exports and imports.
 *
 * The extension keeps player data in two unrelated stores - the
 * chrome.storage.local player caches (src/storage/playerCache.ts) and the
 * skill-history IndexedDB owned by the background worker (src/background.ts) -
 * and the Player Report's clear action wipes both. Skill history is the half
 * that cannot be rebuilt by browsing: it comes from month-by-month gather
 * walks, one player at a time. So a backup has to cover both stores or it
 * doesn't make the clear safe.
 *
 * Both stores are already plain JSON-serialisable, so the file is a straight
 * dump of each rather than a bespoke encoding - it stays readable, and a
 * restore is just a write-back.
 */

import { PlayerCacheStorage } from "@/types/StoredPlayer";
import { SkillHistoryEntry } from "@/types/SkillHistory";
import { LeagueTeams, ScoutSnapshot } from "@/types/ScoutSnapshot";
import { Sport } from "@/types/Sport";

/**
 * Marks a file as ours. Import rejects anything without it rather than trying
 * to interpret an arbitrary JSON file as player data.
 */
export const BACKUP_FORMAT = "ppm-assistant-backup";

/**
 * Bumped only when the file's shape changes incompatibly. Import refuses
 * versions it doesn't know: reading a newer file with older code would drop
 * whatever the new version added, silently, during a restore.
 */
export const BACKUP_VERSION = 3;

/**
 * Versions import still reads. 2 only added `sportSkillHistory` beside the
 * unchanged hockey `skillHistory`, so a version-1 file is simply one with no
 * other sports in it. 3 added the scouted data (`scoutSnapshots`, `leagues`)
 * the same way: an older file is one with none.
 */
export const SUPPORTED_BACKUP_VERSIONS: readonly number[] = [1, 2, 3];

/** Sports whose history lives outside the original hockey `skillHistory` field. */
export type OtherSport = Exclude<Sport, "hockey">;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** ISO timestamp, shown in the import dialog so the file can be identified. */
  exportedAt: string;
  /** chrome.runtime.getManifest().version at export time, for diagnostics. */
  extensionVersion: string;
  /** Storage key -> cache, verbatim. Keys matter: see importCaches(). */
  playerCaches: Record<string, PlayerCacheStorage>;
  /** Hockey's history - the field every version has had. */
  skillHistory: SkillHistoryEntry[];
  /** Version 2+: every other sport's history, by sport. */
  sportSkillHistory?: Partial<Record<OtherSport, SkillHistoryEntry<unknown>[]>>;
  /** Version 3+: other teams' rosters, by sport (src/types/ScoutSnapshot.ts). */
  scoutSnapshots?: Partial<Record<Sport, ScoutSnapshot[]>>;
  /** Version 3+: the user's league per sport, which the LEAGUE line filters by. */
  leagues?: Partial<Record<Sport, LeagueTeams>>;
}

/**
 * How an import combines the file with what's already stored.
 *
 * - "merge" never loses data: the file and the store compose. History goes
 *   through the worker's existing per-field merge, and a player present in
 *   both keeps whichever copy was updated most recently.
 * - "replace" makes the store match the file exactly, discarding anything
 *   captured since the export.
 *
 * Restoring onto an empty store behaves identically either way; the choice
 * only matters when importing onto data.
 */
export type ImportMode = "merge" | "replace";

/**
 * Result of validating a candidate backup file.
 *
 * Rows are filtered rather than fatal. An entry missing its `id` would throw
 * inside the worker's put() and abort the whole transaction, taking every good
 * row with it, so the malformed ones are dropped here and counted - a restore
 * that saves most of the data beats one that saves none.
 */
export interface ParsedBackup {
  backup: BackupFile;
  /** History entries dropped for failing validation. */
  skippedEntries: number;
  /** Cache keys dropped for failing validation. */
  skippedCaches: number;
}
