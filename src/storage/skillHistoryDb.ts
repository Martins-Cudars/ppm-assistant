/**
 * IndexedDB-backed store for daily player skill history, parsed from
 * treninu-progress.html. This is a time-series store and is intentionally
 * separate from src/storage/playerCache.ts (chrome.storage.local), which only
 * ever keeps the latest snapshot per player.
 */

import { SkillHistoryEntry } from "@/types/SkillHistory";

const DB_NAME = "ppm-assistant-skill-history";
const DB_VERSION = 1;
const STORE_NAME = "skillHistory";
const PLAYER_INDEX = "by_playerId";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex(PLAYER_INDEX, "playerId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Upserts a batch of skill history entries in a single transaction.
 * Repeat visits to the same month overwrite existing rows for the same
 * `id` (playerId:date), so this is idempotent.
 */
export async function upsertSkillHistoryEntries(
  entries: SkillHistoryEntry[]
): Promise<{ written: number }> {
  if (entries.length === 0) {
    return { written: 0 };
  }

  try {
    const db = await openDb();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      entries.forEach((entry) => store.put(entry));

      tx.oncomplete = () => resolve({ written: entries.length });
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("[SkillHistoryDb] Failed to upsert entries:", error);
    return { written: 0 };
  }
}

/**
 * Retrieves all stored history entries for a player, ascending by date.
 * Sorted in memory rather than via a compound index range - per-player row
 * counts are small (at most ~112/season), so this is cheap.
 */
export async function getSkillHistoryForPlayer(
  playerId: string
): Promise<SkillHistoryEntry[]> {
  try {
    const db = await openDb();

    const entries = await new Promise<SkillHistoryEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index(PLAYER_INDEX);
      const request = index.getAll(IDBKeyRange.only(playerId));

      request.onsuccess = () => resolve(request.result as SkillHistoryEntry[]);
      request.onerror = () => reject(request.error);
    });

    return entries.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error(
      `[SkillHistoryDb] Failed to load history for player ${playerId}:`,
      error
    );
    return [];
  }
}
