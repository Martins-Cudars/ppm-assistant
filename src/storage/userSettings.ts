/**
 * Persistent user settings stored in chrome.storage.local under a single key.
 * Written by content scripts as the user browses the game; read by extension pages.
 */

const SETTINGS_KEY = "ppm-assistant:settings";

export interface UserSettings {
  lang: string;        // e.g. "lv", "en"
  sport: string;       // e.g. "hockey", "soccer", "basketball"
  playerPage: string;  // Language-specific player profile filename, e.g. "speletajs.html" or "player.html"
}

/**
 * Persist (partial) user settings — merges with whatever is already stored.
 */
export async function saveUserSettings(patch: Partial<UserSettings>): Promise<void> {
  try {
    const existing = await getUserSettings();
    await chrome.storage.local.set({ [SETTINGS_KEY]: { ...existing, ...patch } });
  } catch (error) {
    console.error("[UserSettings] Failed to save:", error);
  }
}

/**
 * Load user settings. Returns sensible defaults when nothing is stored yet.
 */
export async function getUserSettings(): Promise<UserSettings> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return {
      lang: "en",
      sport: "hockey",
      playerPage: "player.html",
      ...(result[SETTINGS_KEY] ?? {}),
    };
  } catch (error) {
    console.error("[UserSettings] Failed to load:", error);
    return { lang: "en", sport: "hockey", playerPage: "player.html" };
  }
}
