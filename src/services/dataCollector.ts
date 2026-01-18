/**
 * Data collector service - Orchestrates the parse → merge → persist flow
 * Handles both single player and batch operations
 */

import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { getPlayer, savePlayer } from "@/storage/playerCache";
import { mergePlayerData, isIncomingMoreComplete } from "./dataMerger";

/**
 * Collects and persists a single player's data
 * Loads cached data, merges with incoming data, and saves result
 *
 * @param player - Incoming HockeyPlayer instance from current view
 * @param source - View that provided this data
 */
export function collectPlayerData(
  player: HockeyPlayer,
  source: "PlayerProfile" | "PlayersList" | "PlayerContracts"
): void {
  try {
    // Load cached player if exists
    const cachedPlayer = getPlayer(player.id);

    // Merge with incoming data
    const mergedPlayer = mergePlayerData(cachedPlayer, player);

    // Log merge results for debugging
    if (cachedPlayer) {
      const isMoreComplete = isIncomingMoreComplete(cachedPlayer, player);
      if (isMoreComplete) {
        console.log(
          `[DataCollector] Updated player ${player.id} with more complete data from ${source}`
        );
      } else {
        console.log(
          `[DataCollector] Updated player ${player.id} timestamp from ${source}`
        );
      }
    } else {
      console.log(
        `[DataCollector] New player ${player.id} cached from ${source}`
      );
    }

    // Save merged result to cache
    savePlayer(mergedPlayer, source);
  } catch (error) {
    console.error(
      `[DataCollector] Failed to collect data for player ${player.id}:`,
      error
    );
  }
}

/**
 * Collects and persists multiple players' data in batch
 * More efficient than calling collectPlayerData in a loop
 *
 * @param players - Array of HockeyPlayer instances
 * @param source - View that provided this data
 */
export function collectBatchPlayerData(
  players: HockeyPlayer[],
  source: "PlayerProfile" | "PlayersList" | "PlayerContracts"
): void {
  try {
    console.log(
      `[DataCollector] Batch collecting ${players.length} players from ${source}`
    );

    let newCount = 0;
    let updatedCount = 0;

    for (const player of players) {
      const cachedPlayer = getPlayer(player.id);
      const mergedPlayer = mergePlayerData(cachedPlayer, player);
      savePlayer(mergedPlayer, source);

      if (cachedPlayer) {
        updatedCount++;
      } else {
        newCount++;
      }
    }

    console.log(
      `[DataCollector] Batch complete: ${newCount} new, ${updatedCount} updated from ${source}`
    );
  } catch (error) {
    console.error(
      `[DataCollector] Failed to collect batch data from ${source}:`,
      error
    );
  }
}
