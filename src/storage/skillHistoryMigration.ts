/**
 * One-time migration of skill-history data captured before the background
 * service worker existed. That old data lives in an IndexedDB database
 * scoped to the game's own origin (see src/storage/legacySkillHistoryDb.ts)
 * and would otherwise be unreachable now that the "real" store lives in the
 * background worker's origin instead.
 */

import { getAllLegacyEntries } from "@/storage/legacySkillHistoryDb";
import { upsertSkillHistoryEntries } from "@/storage/skillHistoryDb";

const MIGRATED_FLAG_KEY = "ppm-assistant:skillHistoryMigratedToBackground";

export async function migrateLegacySkillHistoryIfNeeded(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(MIGRATED_FLAG_KEY);
    if (result[MIGRATED_FLAG_KEY]) {
      return;
    }

    const legacyEntries = await getAllLegacyEntries();
    if (legacyEntries.length > 0) {
      const { written } = await upsertSkillHistoryEntries(legacyEntries);
      console.log(
        `[SkillHistoryMigration] Migrated ${written} legacy skill history entries to the background store`
      );
    }

    await chrome.storage.local.set({ [MIGRATED_FLAG_KEY]: true });
  } catch (error) {
    console.error("[SkillHistoryMigration] Migration failed:", error);
  }
}
