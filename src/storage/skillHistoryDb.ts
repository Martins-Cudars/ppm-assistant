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

import { SkillHistoryEntry } from "@/types/SkillHistory";
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
