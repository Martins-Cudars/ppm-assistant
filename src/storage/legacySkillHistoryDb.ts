/**
 * One-time-use reader for the OLD skill-history IndexedDB database, which
 * was opened directly from content scripts and is therefore scoped to the
 * game's own origin (https://hockey.powerplaymanager.com), not the
 * extension's origin. Used only by src/storage/skillHistoryMigration.ts to
 * copy that data into the new background-worker-owned store (see
 * src/background.ts).
 *
 * The database itself is deleted per-user right after that user's own
 * successful migration (see deleteLegacyDatabase() below and its call site
 * in skillHistoryMigration.ts). This *file* is a separate matter - it's
 * still safe to delete in a future cleanup, but only once the migration
 * (and this deletion) has rolled out to all users.
 */

import { SkillHistoryEntry } from "@/types/SkillHistory";

const DB_NAME = "ppm-assistant-skill-history";
const DB_VERSION = 1;
const STORE_NAME = "skillHistory";
const PLAYER_INDEX = "by_playerId";

async function legacyDatabaseExists(): Promise<boolean> {
  const databases = await indexedDB.databases();
  return databases.some((database) => database.name === DB_NAME);
}

/**
 * Reads every entry from the old on-page IndexedDB database, without ever
 * creating it if it doesn't already exist. Returns an empty array if there's
 * genuinely nothing to migrate, or null if the read failed - callers must
 * treat those two cases differently, since a null read should be retried
 * rather than treated as "nothing to migrate".
 */
export async function getAllLegacyEntries(): Promise<SkillHistoryEntry[] | null> {
  try {
    if (!(await legacyDatabaseExists())) {
      return [];
    }

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

    try {
      return await new Promise<SkillHistoryEntry[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result as SkillHistoryEntry[]);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  } catch (error) {
    console.error("[LegacySkillHistoryDb] Failed to read legacy entries:", error);
    return null;
  }
}

/**
 * Deletes the legacy database. Best-effort cleanup, not correctness-critical -
 * called only after a successful migration, so failure here just leaves an
 * already-migrated, now-unused database in place rather than losing data.
 */
export async function deleteLegacyDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error("[LegacySkillHistoryDb] Failed to delete legacy database:", request.error);
      resolve();
    };
    request.onblocked = () => {
      console.warn("[LegacySkillHistoryDb] Legacy database deletion blocked");
      resolve();
    };
  });
}
