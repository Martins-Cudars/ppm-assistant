/**
 * chrome.storage.local abstraction layer for player data caching
 * Uses chrome.storage.local which is shared across all extension contexts
 * (content scripts, extension pages, background scripts)
 */

import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { PlayerCacheStorage } from "@/types/StoredPlayer";
import { generateStorageKey } from "./storageKeys";
import { serializePlayer, deserializePlayer } from "./serialization";

/**
 * Loads the entire cache structure from chrome.storage.local (async)
 * @returns Promise with PlayerCacheStorage or null if no cache exists or on error
 */
async function loadCache(): Promise<PlayerCacheStorage | null> {
  try {
    const key = generateStorageKey();
    const result = await chrome.storage.local.get(key);
    if (!result[key]) {
      return null;
    }
    return result[key] as PlayerCacheStorage;
  } catch (error) {
    console.error("[PlayerCache] Failed to load cache:", error);
    return null;
  }
}

/**
 * Saves the cache structure to chrome.storage.local (async)
 * @param cache - Cache structure to save
 */
async function saveCache(cache: PlayerCacheStorage): Promise<void> {
  try {
    const key = generateStorageKey();
    await chrome.storage.local.set({ [key]: cache });
  } catch (error) {
    if (error instanceof Error && error.message.includes("QUOTA_BYTES")) {
      console.error("[PlayerCache] Storage quota exceeded. Consider clearing old data.");
    } else {
      console.error("[PlayerCache] Failed to save cache:", error);
    }
    throw error;
  }
}

/**
 * Initializes a new empty cache structure
 * @returns New empty PlayerCacheStorage
 */
function initializeCache(): PlayerCacheStorage {
  const teamId = generateStorageKey().split("-").pop() || "unknown";

  // Get current season day from the page
  let seasonDay = 1;
  try {
    const { getCurrentSeasonDay } = require("@/utils");
    seasonDay = getCurrentSeasonDay();
  } catch (error) {
    console.warn("[PlayerCache] Could not get current season day, using default");
  }

  return {
    players: {},
    teamId,
    currentSeasonDay: seasonDay,
    lastModified: new Date().toISOString(),
  };
}

/**
 * Saves a single player to the cache (async)
 * Merges with existing cache or creates new one
 * @param player - HockeyPlayer instance to save
 * @param source - View source that provided this data
 */
export async function savePlayer(
  player: HockeyPlayer,
  source: "PlayerProfile" | "PlayersList" | "PlayerContracts"
): Promise<void> {
  try {
    let cache = await loadCache();
    if (!cache) {
      cache = initializeCache();
    }

    const serialized = serializePlayer(player, source);
    cache.players[player.id] = serialized;
    cache.lastModified = new Date().toISOString();

    await saveCache(cache);
  } catch (error) {
    console.error(`[PlayerCache] Failed to save player ${player.id}:`, error);
  }
}

/**
 * Retrieves a single player from the cache (async)
 * @param id - Player ID to retrieve
 * @returns Promise with HockeyPlayer instance or null if not found
 */
export async function getPlayer(id: string): Promise<HockeyPlayer | null> {
  try {
    const cache = await loadCache();
    if (!cache || !cache.players[id]) {
      return null;
    }

    return deserializePlayer(cache.players[id]);
  } catch (error) {
    console.error(`[PlayerCache] Failed to load player ${id}:`, error);
    return null;
  }
}

/**
 * Retrieves all cached players (async)
 * @returns Promise with array of HockeyPlayer instances
 */
export async function getAllPlayers(): Promise<HockeyPlayer[]> {
  try {
    const cache = await loadCache();
    if (!cache) {
      return [];
    }

    return Object.values(cache.players).map((data) => deserializePlayer(data));
  } catch (error) {
    console.error("[PlayerCache] Failed to load all players:", error);
    return [];
  }
}

/**
 * Retrieves all cached players from ALL teams (for extension pages)
 * @returns Promise with array of HockeyPlayer instances and cache metadata
 */
export async function getAllPlayersFromAllCaches(): Promise<{
  players: HockeyPlayer[];
  currentSeasonDay: number;
  teamId: string;
}> {
  try {
    // Get all storage data
    const allData = await chrome.storage.local.get(null);

    // Find all hockey team cache keys
    const hockeyKeys = Object.keys(allData).filter((key) =>
      key.startsWith("ppm-assistant:hockey:team-") && !key.includes("unknown")
    );

    console.log("[PlayerCache] Found hockey cache keys:", hockeyKeys);

    if (hockeyKeys.length === 0) {
      return { players: [], currentSeasonDay: 1, teamId: "unknown" };
    }

    // Use the first cache (or we could merge all caches if user has multiple teams)
    const cacheKey = hockeyKeys[0];
    const cache = allData[cacheKey] as PlayerCacheStorage;

    if (!cache || !cache.players) {
      return { players: [], currentSeasonDay: 1, teamId: "unknown" };
    }

    const players = Object.values(cache.players).map((data) =>
      deserializePlayer(data)
    );

    console.log(
      `[PlayerCache] Loaded ${players.length} players from ${cacheKey}`
    );

    return {
      players,
      currentSeasonDay: cache.currentSeasonDay || 1,
      teamId: cache.teamId || "unknown",
    };
  } catch (error) {
    console.error("[PlayerCache] Failed to load from all caches:", error);
    return { players: [], currentSeasonDay: 1, teamId: "unknown" };
  }
}

/**
 * Clears the entire cache for the current team (async)
 */
export async function clearCache(): Promise<void> {
  try {
    const key = generateStorageKey();
    await chrome.storage.local.remove(key);
    console.log("[PlayerCache] Cache cleared successfully");
  } catch (error) {
    console.error("[PlayerCache] Failed to clear cache:", error);
  }
}

/**
 * Gets the storage key being used for debugging purposes
 * @returns Current storage key
 */
export function getStorageKey(): string {
  return generateStorageKey();
}

/**
 * Gets cache statistics for debugging (async)
 * @returns Promise with object containing cache stats
 */
export async function getCacheStats(): Promise<{
  playerCount: number;
  lastModified: string | null;
  teamId: string;
}> {
  const cache = await loadCache();
  if (!cache) {
    return {
      playerCount: 0,
      lastModified: null,
      teamId: "unknown",
    };
  }

  return {
    playerCount: Object.keys(cache.players).length,
    lastModified: cache.lastModified,
    teamId: cache.teamId,
  };
}

/**
 * Clears invalid cache entries (e.g., team-unknown)
 * Should be called on extension startup to clean up corrupted data
 */
export async function clearInvalidCaches(): Promise<void> {
  try {
    const allData = await chrome.storage.local.get(null);
    const invalidKeys = Object.keys(allData).filter(
      (key) => key.includes("team-unknown") && key.startsWith("ppm-assistant:")
    );

    if (invalidKeys.length > 0) {
      console.log("[PlayerCache] Clearing invalid cache keys:", invalidKeys);
      await chrome.storage.local.remove(invalidKeys);
    }
  } catch (error) {
    console.error("[PlayerCache] Failed to clear invalid caches:", error);
  }
}
