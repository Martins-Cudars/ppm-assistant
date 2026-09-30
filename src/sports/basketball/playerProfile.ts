import { PlayerCalculationProfile } from "@/classes/playerProfile";
import { positionSettings } from "./settings";

export const basketballPlayerProfile: PlayerCalculationProfile = {
  unknownPositionName: "?",
  requiresVisibility: false,
  // A basketball season is 70 days, not hockey's 112 - the game header reads
  // "Season: 64 (66/70)". Every basketball age derived from a date uses this.
  daysPerSeason: 70,
  growthPrediction: [],
  positionSettings,
};
