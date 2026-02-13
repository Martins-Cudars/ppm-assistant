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
  // Handle legacy data that might not have newer properties
  const scoutingStatus = data.scoutingStatus || "UNSCOUTED";

  // Ensure baseInfo has all required properties with defensive defaults for legacy data
  // This prevents "undefined.method()" errors when old cached data lacks newer properties
  const baseInfo: HockeyPlayerInfo = {
    id: data.baseInfo.id,
    name: data.baseInfo.name || "Unknown",
    age: data.baseInfo.age ?? 15,
    careerLongitivity: data.baseInfo.careerLongitivity ?? 0,
    overallRating: data.baseInfo.overallRating ?? 0,
    averageTrainingRatio: data.baseInfo.averageTrainingRatio ?? 0,
    preferredSide: data.baseInfo.preferredSide || "U",
    countryImage: data.baseInfo.countryImage,
    countryLink: data.baseInfo.countryLink,
    teamPosition: data.baseInfo.teamPosition,
    teamId: data.baseInfo.teamId,
  };

  const player = new HockeyPlayer(
    baseInfo,
    new Date(data.metadata.updatedAt),
    scoutingStatus,
    scoutingStatus === "SCOUTED",
    data.metadata.seasonDay,
    data.skills || undefined,
    data.experience ?? undefined,
    data.trainingQualities || undefined,
    data.injuryDays ?? 0  // Default to 0 if missing in legacy data
  );

  // Recalculate derived properties
  player.calculatePositions();
  player.calculatePositionTrainingQualities();

  return player;
}
