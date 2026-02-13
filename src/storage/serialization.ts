/**
 * Serialization utilities for converting between HockeyPlayer instances and StoredPlayerData
 * Handles Date conversion and data completeness calculation
 */

import { HockeyPlayer, HockeyPlayerInfo } from "@/sports/hockey/classes/HockeyPlayer";
import { StoredPlayerData } from "@/types/StoredPlayer";

/**
 * Calculates data completeness level based on available player data
 * @param player - HockeyPlayer instance
 * @returns Completeness level: "full" | "partial" | "minimal"
 */
export function calculateCompleteness(player: HockeyPlayer): "full" | "partial" | "minimal" {
  if (player.trainingQualities && player.skills && player.experience !== undefined) {
    return "full";
  }
  if (player.skills && player.experience !== undefined) {
    return "partial";
  }
  return "minimal";
}

/**
 * Serializes a HockeyPlayer instance to StoredPlayerData for localStorage
 * Converts Date objects to ISO strings for JSON serialization
 * @param player - HockeyPlayer instance to serialize
 * @param lastViewSource - Source view that provided this data
 * @returns StoredPlayerData object ready for JSON.stringify
 */
export function serializePlayer(
  player: HockeyPlayer,
  lastViewSource: "PlayerProfile" | "PlayersList" | "PlayerContracts"
): StoredPlayerData {
  const baseInfo: HockeyPlayerInfo = {
    id: player.id,
    name: player.name,
    age: player.age,
    careerLongitivity: player.careerLongitivity,
    overallRating: player.overallRating,
    averageTrainingRatio: player.averageTrainingRatio,
    preferredSide: player.preferredSide,
    countryImage: player.countryImage,
    countryLink: player.countryLink,
    teamPosition: player.teamPosition,
    teamId: player.teamId,
  };

  const stored: StoredPlayerData = {
    baseInfo,
    skills: (player.skills as any) || null,
    trainingQualities: (player.trainingQualities as any) || null,
    experience: player.experience ?? null,
    injuryDays: player.injuryDays,
    scoutingStatus: player.scoutingStatus,
    metadata: {
      updatedAt: player.updatedAt.toISOString(),
      seasonDay: player.seasonDay,
      dataCompleteness: calculateCompleteness(player),
      lastViewSource,
    },
  };

  return stored;
}

/**
 * Deserializes StoredPlayerData back into a HockeyPlayer instance
 * Converts ISO string dates back to Date objects
 * Recalculates positions and training qualities after reconstruction
 * @param data - StoredPlayerData from localStorage
 * @returns Reconstructed HockeyPlayer instance
 */
export function deserializePlayer(data: StoredPlayerData): HockeyPlayer {
  const player = new HockeyPlayer(
    data.baseInfo,
    new Date(data.metadata.updatedAt),
    data.scoutingStatus,
    data.scoutingStatus === "SCOUTED",
    data.metadata.seasonDay,
    data.skills || undefined,
    data.experience ?? undefined,
    data.trainingQualities || undefined,
    data.injuryDays
  );

  // Recalculate derived properties
  player.calculatePositions();
  player.calculatePositionTrainingQualities();

  return player;
}
