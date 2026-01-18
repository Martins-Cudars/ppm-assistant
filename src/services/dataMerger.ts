/**
 * Data merging service for intelligently combining player data from different sources
 * Implements confidence-based merging with temporal ordering and season change detection
 */

import { HockeyPlayer, HockeyPlayerInfo } from "@/sports/hockey/classes/HockeyPlayer";
import { isNewSeason } from "@/storage/storageKeys";
import { getCurrentSeasonDay } from "@/utils";

/**
 * Merges incoming player data with existing cached data
 * Rules:
 * - Always prefer newer data (updatedAt comparison)
 * - Never overwrite non-null skills/trainingQualities/experience with null
 * - New season detection: If new season started, discard existing data entirely
 * - No versioning: Result overwrites existing player object
 *
 * @param existing - Cached player data (can be null if no cache exists)
 * @param incoming - New player data from current view
 * @returns Merged HockeyPlayer instance
 */
export function mergePlayerData(
  existing: HockeyPlayer | null,
  incoming: HockeyPlayer
): HockeyPlayer {
  // If no existing data, return incoming as-is
  if (!existing) {
    return incoming;
  }

  const currentSeasonDay = getCurrentSeasonDay();

  // Check for season rollover - if new season, discard all cached data
  if (isNewSeason(existing.seasonDay, currentSeasonDay)) {
    console.log(
      `[DataMerger] New season detected for player ${incoming.id}. Discarding cached data.`
    );
    return incoming;
  }

  // If incoming data is older, keep existing (temporal ordering)
  if (incoming.updatedAt < existing.updatedAt) {
    console.log(
      `[DataMerger] Incoming data for player ${incoming.id} is older. Keeping existing.`
    );
    return existing;
  }

  // Merge base info (always use incoming as it's newer)
  const mergedBaseInfo: HockeyPlayerInfo = {
    ...existing,
    ...incoming,
    // Preserve country/team data if incoming doesn't have it
    countryImage: incoming.countryImage || existing.countryImage,
    countryLink: incoming.countryLink || existing.countryLink,
    teamPosition: incoming.teamPosition || existing.teamPosition,
  };

  // Merge skills - prefer incoming, but keep existing if incoming is null
  const mergedSkills = incoming.skills || existing.skills;

  // Merge training qualities - prefer incoming, but keep existing if incoming is null
  const mergedTrainingQualities =
    incoming.trainingQualities || existing.trainingQualities;

  // Merge experience - prefer incoming, but keep existing if incoming is undefined/null
  const mergedExperience =
    incoming.experience !== undefined && incoming.experience !== null
      ? incoming.experience
      : existing.experience;

  // Merge injury days (always use incoming as it's newer)
  const mergedInjuryDays = incoming.injuryDays;

  // Merge scouting status (prefer higher visibility)
  const mergedScoutingStatus =
    incoming.scoutingStatus === "SCOUTED" ||
    existing.scoutingStatus === "SCOUTED"
      ? "SCOUTED"
      : incoming.scoutingStatus === "IN_PROGRESS" ||
        existing.scoutingStatus === "IN_PROGRESS"
      ? "IN_PROGRESS"
      : "UNSCOUTED";

  // Create merged player instance
  const merged = new HockeyPlayer(
    mergedBaseInfo,
    incoming.updatedAt, // Use newer timestamp
    mergedScoutingStatus,
    mergedScoutingStatus === "SCOUTED",
    incoming.seasonDay, // Use current season day
    mergedSkills as any,
    mergedExperience,
    mergedTrainingQualities as any,
    mergedInjuryDays
  );

  // Recalculate derived properties
  merged.calculatePositions();
  merged.calculatePositionTrainingQualities();

  return merged;
}

/**
 * Determines if incoming data is more complete than existing data
 * Used for logging and debugging purposes
 *
 * @param existing - Existing player data
 * @param incoming - Incoming player data
 * @returns True if incoming has more complete data
 */
export function isIncomingMoreComplete(
  existing: HockeyPlayer,
  incoming: HockeyPlayer
): boolean {
  const existingScore = calculateCompletenessScore(existing);
  const incomingScore = calculateCompletenessScore(incoming);
  return incomingScore > existingScore;
}

/**
 * Calculates a completeness score for comparison
 * Higher score = more complete data
 *
 * @param player - Player to score
 * @returns Completeness score
 */
function calculateCompletenessScore(player: HockeyPlayer): number {
  let score = 0;
  if (player.skills) score += 2;
  if (player.trainingQualities) score += 3; // Training qualities are most valuable
  if (player.experience !== undefined && player.experience !== null) score += 1;
  return score;
}
