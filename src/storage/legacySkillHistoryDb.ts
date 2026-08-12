/**
 * One-time-use reader for the OLD skill-history IndexedDB database, which
 * was opened directly from content scripts and is therefore scoped to the
 * game's own origin (https://hockey.powerplaymanager.com), not the
 * extension's origin. Used only by src/storage/skillHistoryMigration.ts to
 * copy that data into the new background-worker-owned store (see
 * src/background.ts). Safe to delete this file in a future cleanup once the
 * migration has rolled out to all users.
 */

import { SkillHistoryEntry } from "@/types/SkillHistory";

const DB_NAME = "ppm-assistant-skill-history";
const DB_VERSION = 1;
const STORE_NAME = "skillHistory";
const PLAYER_INDEX = "by_playerId";

/**
 * Reads every entry from the old on-page IndexedDB database. Returns an
 * empty array if the database doesn't exist yet (nothing to migrate) or on
 * any other error.
 */
export async function getAllLegacyEntries(): Promise<SkillHistoryEntry[]> {
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const upgradeDb = request.result;
        if (!upgradeDb.objectStoreNames.contains(STORE_NAME)) {
          const store = upgradeDb.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex(PLAYER_INDEX, "playerId", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return await new Promise<SkillHistoryEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as SkillHistoryEntry[]);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[LegacySkillHistoryDb] Failed to read legacy entries:", error);
    return [];
  }
}
