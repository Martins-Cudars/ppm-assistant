/**
 * Message contract between the client-side skill-history API
 * (src/storage/skillHistoryDb.ts, callable from any extension context) and
 * the background service worker (src/background.ts), which owns the actual
 * IndexedDB database. Needed because IndexedDB is isolated per-origin, and
 * the extension's own pages (e.g. player-report.html) run under a different
 * origin than the game pages that capture the data - routing both through
 * the background worker's own origin makes the data reachable from anywhere.
 */

import {
  SkillHistoryEntry,
  SkillHistoryStats,
  SkillHistorySummary,
} from "@/types/SkillHistory";

export type SkillHistoryMessage =
  | { type: "SKILL_HISTORY_UPSERT"; entries: SkillHistoryEntry[] }
  | { type: "SKILL_HISTORY_GET"; playerId: string }
  // Coverage for every player at once. Takes no arguments: a summary is five
  // small fields, and the callers that need one need the whole set, so paying
  // for a round-trip per player would be pure overhead.
  | { type: "SKILL_HISTORY_SUMMARY" }
  // Storage footprint. Reads every record, unlike the summary, so only send it
  // when the numbers are actually being displayed.
  | { type: "SKILL_HISTORY_STATS" }
  // The only destructive verb: empties the whole store. There is no undo and
  // no per-player variant - rebuilding means re-running the gather walks.
  | { type: "SKILL_HISTORY_CLEAR" }
  // Every record, for the backup file. Distinct from SUMMARY (keys only) and
  // STATS (reads records but returns counts): this is the one caller that
  // genuinely needs the values, so it pays the full cost knowingly.
  | { type: "SKILL_HISTORY_EXPORT" };

export type SkillHistoryResponse =
  | { type: "SKILL_HISTORY_UPSERT"; written: number }
  | { type: "SKILL_HISTORY_GET"; entries: SkillHistoryEntry[] }
  | { type: "SKILL_HISTORY_SUMMARY"; summaries: SkillHistorySummary[] }
  | { type: "SKILL_HISTORY_STATS"; stats: SkillHistoryStats }
  // How many records were removed, or null if the clear failed. The other
  // responses report failure as an empty result, which is harmless for a read.
  // Here it would not be: a caller told "0 removed" blanks its display, and the
  // untouched data reappears on the next reload.
  | { type: "SKILL_HISTORY_CLEAR"; cleared: number | null }
  // Null on failure, for the same reason as CLEAR above and more sharply: an
  // export that reported failure as an empty array would write a backup file
  // containing no history at all, which the user would then trust and act on.
  | { type: "SKILL_HISTORY_EXPORT"; entries: SkillHistoryEntry[] | null };
