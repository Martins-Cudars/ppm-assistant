/**
 * Client-side API for daily player skill history, parsed from
 * treninu-progress.html. This is a time-series store and is intentionally
 * separate from src/storage/playerCache.ts (chrome.storage.local), which only
 * ever keeps the latest snapshot per player.
 *
 * The actual IndexedDB database is owned by the background service worker
 * (src/background.ts), not by whichever page calls these functions -
 * IndexedDB is isolated per-origin, and this API is called both from content
 * scripts on the game's pages and from the standalone player-report.html
 * extension page, which run under different origins. Routing through the
 * background worker (a single, consistent chrome-extension:// origin) makes
 * the data reachable from anywhere. See src/types/SkillHistoryMessages.ts
 * for the message contract.
 */

import {
  SkillHistoryEntry,
  SkillHistoryStats,
  SkillHistorySummary,
} from "@/types/SkillHistory";
import { SkillHistoryMessage, SkillHistoryResponse } from "@/types/SkillHistoryMessages";

async function sendSkillHistoryMessage(
  message: SkillHistoryMessage
): Promise<SkillHistoryResponse> {
  return chrome.runtime.sendMessage(message);
}

/**
 * Upserts a batch of skill history entries. Repeat visits to the same month
 * overwrite existing rows for the same `id` (playerId:date), so this is
 * idempotent.
 */
export async function upsertSkillHistoryEntries(
  entries: SkillHistoryEntry[]
): Promise<{ written: number }> {
  if (entries.length === 0) {
    return { written: 0 };
  }

  try {
    const response = await sendSkillHistoryMessage({
      type: "SKILL_HISTORY_UPSERT",
      entries,
    });
    return { written: response.type === "SKILL_HISTORY_UPSERT" ? response.written : 0 };
  } catch (error) {
    console.error("[SkillHistoryDb] Failed to upsert entries:", error);
    return { written: 0 };
  }
}

/**
 * Coverage for every player that has any stored history, keyed by playerId.
 *
 * One round-trip for the whole store, so a table of players can be annotated
 * without a message per row. Players with no history are simply absent from
 * the map - callers should treat a miss as "nothing stored".
 */
export async function getSkillHistorySummaries(): Promise<
  Map<string, SkillHistorySummary>
> {
  try {
    const response = await sendSkillHistoryMessage({ type: "SKILL_HISTORY_SUMMARY" });
    if (response.type !== "SKILL_HISTORY_SUMMARY") {
      return new Map();
    }
    return new Map(response.summaries.map((summary) => [summary.playerId, summary]));
  } catch (error) {
    console.error("[SkillHistoryDb] Failed to load history summaries:", error);
    return new Map();
  }
}

/**
 * Measures the store's footprint. Reads every record on the worker side, so
 * call it only where the numbers are shown - not as a cheap liveness check.
 */
export async function getSkillHistoryStats(): Promise<SkillHistoryStats> {
  try {
    const response = await sendSkillHistoryMessage({ type: "SKILL_HISTORY_STATS" });
    if (response.type !== "SKILL_HISTORY_STATS") {
      return { records: 0, players: 0, jsonBytes: 0 };
    }
    return response.stats;
  } catch (error) {
    console.error("[SkillHistoryDb] Failed to measure history storage:", error);
    return { records: 0, players: 0, jsonBytes: 0 };
  }
}

/**
 * Every stored entry, for the backup file. Returns null if the read failed.
 *
 * Like clearSkillHistory(), this reports failure rather than degrading to an
 * empty result - and here the stakes are higher than a blank chart: an export
 * that treated failure as "no history" would hand the user a backup file with
 * nothing in it, which they would then keep and rely on.
 */
export async function exportSkillHistory(): Promise<SkillHistoryEntry[] | null> {
  try {
    const response = await sendSkillHistoryMessage({ type: "SKILL_HISTORY_EXPORT" });
    return response.type === "SKILL_HISTORY_EXPORT" ? response.entries : null;
  } catch (error) {
    console.error("[SkillHistoryDb] Failed to export history:", error);
    return null;
  }
}

/**
 * Retrieves all stored history entries for a player, ascending by date.
 */
export async function getSkillHistoryForPlayer(
  playerId: string
): Promise<SkillHistoryEntry[]> {
  try {
    const response = await sendSkillHistoryMessage({
      type: "SKILL_HISTORY_GET",
      playerId,
    });
    return response.type === "SKILL_HISTORY_GET" ? response.entries : [];
  } catch (error) {
    console.error(
      `[SkillHistoryDb] Failed to load history for player ${playerId}:`,
      error
    );
    return [];
  }
}

/**
 * Empties the whole history store, returning the number of records removed,
 * or null if the clear failed.
 *
 * The only reader in this file that reports failure rather than swallowing it
 * into a benign empty value. The others can: a failed read just draws an empty
 * chart. Here, "0" and "it did not happen" mean opposite things, and a caller
 * that cannot tell them apart will show the user an empty store while the data
 * is still on disk.
 *
 * There is no undo - history is rebuilt only by re-running the gather walks
 * that produced it - so callers should confirm with the user first.
 */
export async function clearSkillHistory(): Promise<number | null> {
  try {
    const response = await sendSkillHistoryMessage({ type: "SKILL_HISTORY_CLEAR" });
    return response.type === "SKILL_HISTORY_CLEAR" ? response.cleared : null;
  } catch (error) {
    console.error("[SkillHistoryDb] Failed to clear history:", error);
    return null;
  }
}
