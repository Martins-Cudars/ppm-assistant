import { PlayerCalculationProfile } from "@/classes/playerProfile";
import { playerGrowthPrediction, positionSettings } from "./settings";

export const soccerPlayerProfile: PlayerCalculationProfile = {
  unknownPositionName: "?",
  requiresVisibility: false,
  bonusCapRatio: 0.35,
  daysPerSeason: 112,
  growthPrediction: playerGrowthPrediction,
  positionSettings,
};
