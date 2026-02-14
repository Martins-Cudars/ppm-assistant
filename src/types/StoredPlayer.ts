import { HockeyPlayerInfo, HockeySkills, ScoutingStatus } from "@/sports/hockey/classes/HockeyPlayer";

export interface StoredPlayerData {
  baseInfo: HockeyPlayerInfo;
  skills: HockeySkills | null;
  trainingQualities: Record<string, number> | null; // Generic record for training qualities
  experience: number | null;
  injuryDays: number;
  scoutingStatus: ScoutingStatus;
  metadata: {
    updatedAt: string; // ISO date string
    seasonDay: number;
    dataCompleteness: "full" | "partial" | "minimal";
    lastViewSource: "PlayerProfile" | "PlayersList" | "PlayerContracts" | "PlayerTraining";
  };
}

export interface PlayerCacheStorage {
  players: {
    [playerId: string]: StoredPlayerData; // One current object per player (no history)
  };
  teamId: string;
  currentSeasonDay: number; // Current season day when data was collected
  lastModified: string; // ISO date string
}
