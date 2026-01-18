/**
 * localStorage abstraction layer for player data caching
 * Provides CRUD operations with error handling and quota management
 */

import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { PlayerCacheStorage } from "@/types/StoredPlayer";
import { generateStorageKey } from "./storageKeys";
import { serializePlayer, deserializePlayer } from "./serialization";

/**
 * Loads the entire cache structure from localStorage
 * @returns PlayerCacheStorage or null if no cache exists or on error
 */
function loadCache(): PlayerCacheStorage | null {
  try {
    const key = generateStorageKey();
    const data = localStorage.getItem(key);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as PlayerCacheStorage;
  } catch (error) {
    console.error("[PlayerCache] Failed to load cache:", error);
    // If JSON is corrupted, clear it
    clearCache();
    return null;
  }
}

/**
 * Saves the cache structure to localStorage
 * @param cache - Cache structure to save
 */
function saveCache(cache: PlayerCacheStorage): void {
  try {
    const key = generateStorageKey();
    localStorage.setItem(key, JSON.stringify(cache));
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      console.error("[PlayerCache] Storage quota exceeded. Consider clearing old data.");
      // Could implement LRU eviction here in the future
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
  return {
    players: {},
    teamId,
    lastModified: new Date().toISOString(),
  };
}

/**
 * Saves a single player to the cache
 * Merges with existing cache or creates new one
 * @param player - HockeyPlayer instance to save
 * @param source - View source that provided this data
 */
export function savePlayer(
  player: HockeyPlayer,
  source: "PlayerProfile" | "PlayersList" | "PlayerContracts"
): void {
  try {
    let cache = loadCache();
    if (!cache) {
      cache = initializeCache();
    }

    const serialized = serializePlayer(player, source);
    cache.players[player.id] = serialized;
    cache.lastModified = new Date().toISOString();

    saveCache(cache);
  } catch (error) {
    console.error(`[PlayerCache] Failed to save player ${player.id}:`, error);
  }
}

/**
 * Retrieves a single player from the cache
 * @param id - Player ID to retrieve
 * @returns HockeyPlayer instance or null if not found
 */
export function getPlayer(id: string): HockeyPlayer | null {
  try {
    const cache = loadCache();
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
 * Retrieves all cached players
 * @returns Array of HockeyPlayer instances
 */
export function getAllPlayers(): HockeyPlayer[] {
  try {
    const cache = loadCache();
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
 * Clears the entire cache for the current team
 */
export function clearCache(): void {
  try {
    const key = generateStorageKey();
    localStorage.removeItem(key);
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
 * Gets cache statistics for debugging
 * @returns Object with cache stats
 */
export function getCacheStats(): {
  playerCount: number;
  lastModified: string | null;
  teamId: string;
} {
  const cache = loadCache();
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
