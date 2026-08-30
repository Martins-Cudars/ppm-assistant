/**
 * Export and restore of everything the extension stores.
 *
 * Exists because the Player Report's clear action wipes both stores at once,
 * and one of them - the skill history - cannot be rebuilt by browsing. It comes
 * from month-by-month gather walks run one player at a time, so without a
 * backup the clear button is a one-way door. See src/types/Backup.ts for the
 * file shape.
 *
 * Runs on player-report.html, an ordinary top-level extension tab (opened via
 * chrome.runtime.getURL from viewPlayerList.ts), so a blob download and a file
 * input both work without any extra manifest permission.
 */

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupFile,
  ImportMode,
  ParsedBackup,
} from "@/types/Backup";
import { PlayerCacheStorage } from "@/types/StoredPlayer";
import { SkillHistoryEntry } from "@/types/SkillHistory";
import { exportAllCaches, importCaches } from "@/storage/playerCache";
import {
  clearSkillHistory,
  exportSkillHistory,
  upsertSkillHistoryEntries,
} from "@/storage/skillHistoryDb";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Collects both stores into a backup, or returns null if the history read
 * failed.
 *
 * A failed read must not become an empty array here: that would produce a
 * plausible-looking file with no history in it, which is worse than no file at
 * all because the user would keep it and trust it.
 */
export async function createBackup(): Promise<BackupFile | null> {
  const [playerCaches, skillHistory] = await Promise.all([
    exportAllCaches(),
    exportSkillHistory(),
  ]);

  if (skillHistory === null) {
    console.error("[Backup] Aborting export: could not read skill history");
    return null;
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    extensionVersion: chrome.runtime.getManifest().version,
    playerCaches,
    skillHistory,
  };
}

/** Filename stamp: ppm-assistant-backup-2026-08-28.json */
function backupFilename(backup: BackupFile): string {
  return `ppm-assistant-backup-${backup.exportedAt.slice(0, 10)}.json`;
}

/**
 * Hands the backup to the browser as a download.
 *
 * Not pretty-printed: at ~30k history records the indentation would add
 * megabytes for no benefit, since nothing reads this by eye.
 */
export function downloadBackup(backup: BackupFile): void {
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = backupFilename(backup);
  document.body.appendChild(link);
  link.click();
  link.remove();

  // The blob is held alive by the object URL until it's revoked, and it's a
  // multi-megabyte string. Deferred because revoking synchronously can cancel
  // the download the click just started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function isValidEntry(value: unknown): value is SkillHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<SkillHistoryEntry>;

  return (
    typeof entry.id === "string" &&
    typeof entry.playerId === "string" &&
    typeof entry.date === "string" &&
    ISO_DATE.test(entry.date) &&
    // The store's keyPath is "id", so an id that disagrees with the fields it
    // encodes would silently land under the wrong key and break the summary
    // query, which derives player and date from the key alone.
    entry.id === `${entry.playerId}:${entry.date}`
  );
}

function isValidCache(value: unknown): value is PlayerCacheStorage {
  if (typeof value !== "object" || value === null) return false;
  const cache = value as Partial<PlayerCacheStorage>;

  return typeof cache.players === "object" && cache.players !== null;
}

/**
 * Validates a candidate backup file.
 *
 * Throws on a file that isn't ours or is a version we don't understand -
 * there's nothing sensible to salvage, and guessing at a newer format during a
 * restore would drop whatever it added.
 *
 * Individual rows are filtered rather than fatal. This is load-bearing: the
 * worker's upsert calls put() against a keyPath: "id" store, so one entry
 * without an id throws inside the transaction and aborts it, taking every valid
 * row with it. Dropping the bad rows here is what lets the rest through.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  if (typeof raw !== "object" || raw === null) {
    throw new Error("That file isn't a PPM Assistant backup.");
  }

  const candidate = raw as Partial<BackupFile>;

  if (candidate.format !== BACKUP_FORMAT) {
    throw new Error("That file isn't a PPM Assistant backup.");
  }

  if (candidate.version !== BACKUP_VERSION) {
    throw new Error(
      `Backup version ${candidate.version} isn't supported by this version of the extension.`
    );
  }

  const rawEntries = Array.isArray(candidate.skillHistory) ? candidate.skillHistory : [];
  const skillHistory = rawEntries.filter(isValidEntry);

  const rawCaches =
    typeof candidate.playerCaches === "object" && candidate.playerCaches !== null
      ? candidate.playerCaches
      : {};
  const playerCaches: Record<string, PlayerCacheStorage> = {};
  let skippedCaches = 0;

  Object.entries(rawCaches).forEach(([key, cache]) => {
    if (isValidCache(cache)) {
      playerCaches[key] = cache;
    } else {
      skippedCaches += 1;
    }
  });

  return {
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: candidate.exportedAt ?? "",
      extensionVersion: candidate.extensionVersion ?? "unknown",
      playerCaches,
      skillHistory,
    },
    skippedEntries: rawEntries.length - skillHistory.length,
    skippedCaches,
  };
}

export interface RestoreResult {
  entriesWritten: number;
  playersWritten: number;
}

/**
 * Writes a validated backup into both stores.
 *
 * Ordering is chosen so a failure can't leave the user with less than they
 * started with:
 *
 * - The caches are written before their stale keys are removed, so a failed
 *   write leaves the old caches intact rather than nothing.
 * - History in replace mode is the one place a clear has to come first - the
 *   store has no delete-by-key verb, so "make it match the file" can only be
 *   expressed as clear-then-write. It's deferred until after parseBackup() has
 *   validated every row, which removes the likeliest cause of the write half
 *   failing. If the worker itself then fails, the user still holds the file
 *   they just picked and can retry the import; that's the difference between
 *   this and clearing with no backup at all.
 */
export async function restoreBackup(
  backup: BackupFile,
  mode: ImportMode
): Promise<RestoreResult> {
  if (mode === "replace") {
    const cleared = await clearSkillHistory();
    if (cleared === null) {
      throw new Error("Could not clear the existing history - nothing was changed.");
    }
  }

  // Merge mode needs no clear: the worker's upsert merges per field, so the
  // file and the store compose rather than overwrite.
  const { written } = await upsertSkillHistoryEntries(backup.skillHistory);

  // upsertSkillHistoryEntries() swallows its errors and reports 0, so this is
  // the only signal that the write failed - and after a replace-mode clear the
  // user needs to be told to retry rather than left assuming it worked.
  if (backup.skillHistory.length > 0 && written === 0) {
    throw new Error(
      "The history could not be written. Your backup file is unchanged - try importing it again."
    );
  }

  const playersWritten = await importCaches(backup.playerCaches, mode);

  return { entriesWritten: written, playersWritten };
}
