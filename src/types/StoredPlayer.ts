import { HockeyPlayerInfo, HockeySkills, ScoutingStatus } from "@/sports/hockey/classes/HockeyPlayer";
import { Sport } from "@/types/Sport";

/**
 * One cached player. Generic over the sport's player info and skills; the
 * defaults are hockey's, so hockey code reads it exactly as before.
 */
export interface StoredPlayerData<TInfo = HockeyPlayerInfo, TSkills = HockeySkills> {
  /** Absent on everything written before basketball - which is all hockey. */
  sport?: Sport;
  baseInfo: TInfo;
  skills: TSkills | null;
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

export interface PlayerCacheStorage<TData = StoredPlayerData> {
  players: {
    [playerId: string]: TData; // One current object per player (no history)
  };
  teamId: string;
  currentSeasonDay: number; // Current season day when data was collected
  lastModified: string; // ISO date string
  /**
   * Who was on the squad overview the last time it was opened. `players` alone
   * can't answer "who is on the team": a sold player keeps our teamId there
   * until their profile is visited again. Absent in caches written before the
   * roster was tracked - readers must fall back rather than assume it.
   */
  squad?: {
    playerIds: string[];
    updatedAt: string; // ISO date string
  };
}
