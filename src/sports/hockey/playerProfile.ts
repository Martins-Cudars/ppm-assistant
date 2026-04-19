import { PlayerCalculationProfile } from "@/classes/playerProfile";
import { playerGrowthPrediction, positionSettings } from "./settings";

export const hockeyPlayerProfile: PlayerCalculationProfile = {
  unknownPositionName: "?",
  requiresVisibility: true,
  bonusCapRatio: 0.6,
  daysPerSeason: 112,
  growthPrediction: playerGrowthPrediction,
  positionSettings,
};
