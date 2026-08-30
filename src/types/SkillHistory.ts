import { HockeySkills } from "@/sports/hockey/classes/HockeyPlayer";

/**
 * Where a history entry's data came from. Entries for the same player/day can
 * be written by more than one source, in which case they are merged rather
 * than overwritten (see upsertEntries in src/background.ts).
 */
export type SkillHistorySource =
  | "TrainingProgress"
  | "PlayerProfile"
  | "PlayersList";

/**
 * One day's worth of tracked data for a player.
 *
 * Three capture paths feed this, and each can only supply part of the picture:
 *
 * - treninu-progress.html ("training progress") gives overall rating and
 *   skills for every day of a month, but is only reachable for players on our
 *   own team.
 * - The player profile gives the overall rating for *any* player - including
 *   other teams' - plus `skills` when the player's attributes are visible to
 *   us. It only ever covers the day it was visited.
 * - The squad overview lists overall rating and skills for the whole team at
 *   once, so one visit snapshots every player. Like the profile, it only ever
 *   covers the day it was visited.
 *
 * So every value field is optional: an unscouted opponent yields an entry with
 * an overall rating alone. Consumers must filter for the field they need
 * rather than assume it's present - use the readers in
 * src/sports/hockey/skillHistoryChart.ts.
 *
 * Deliberately excludes per-day training deltas/multipliers (e.g. "(T:1.26)")
 * shown on the training page - only cumulative values are stored. Deltas can
 * be derived later by diffing consecutive entries if ever needed.
 */
export interface SkillHistoryEntry {
  id: string; // `${playerId}:${date}` composite key, e.g. "23869664:2026-07-14"
  playerId: string;
  date: string; // ISO "YYYY-MM-DD"
  overallRating?: number; // "KR" on the LV training page, #index_skill on the profile
  skills?: HockeySkills; // absent when the player's attributes aren't visible
  capturedAt: string; // ISO timestamp of when this row was parsed
  source?: SkillHistorySource;

  /**
   * @deprecated Legacy name for `overallRating`, kept only so entries written
   * before the two were unified still read back. Never write this - use
   * readEntryOverallRating() rather than reading it directly.
   */
  kr?: number;
}

/**
 * Per-player coverage of the history store: how many days are held and what
 * range they span. Deliberately carries no skill values - it exists so a whole
 * table can be summarised in one round-trip, and it is derived from entry keys
 * alone (they encode `${playerId}:${date}`), without reading any record.
 */
export interface SkillHistorySummary {
  playerId: string;
  /** Number of distinct days stored. */
  days: number;
  firstDate: string; // ISO "YYYY-MM-DD"
  lastDate: string; // ISO "YYYY-MM-DD"
  /** Days between first and last with no stored entry; 0 means a solid run. */
  missingDays: number;
}

/**
 * Storage footprint of the whole history store, for display.
 *
 * Separate from SkillHistorySummary on purpose: a summary is derived from entry
 * keys alone, whereas measuring size means reading every record. Only ask for
 * these when actually showing them.
 */
export interface SkillHistoryStats {
  records: number;
  players: number;
  /** Summed JSON byte size of every stored entry. Measured, not estimated. */
  jsonBytes: number;
  /**
   * navigator.storage.estimate().usage for the extension origin, when the
   * browser reports it. Always larger than jsonBytes - it also covers IndexedDB
   * primary keys, the by_playerId index, and per-row overhead.
   */
  originBytes?: number;
}
