import { PlayerCalculationProfile } from "@/classes/playerProfile";
import { positionSettings } from "./settings";

export const basketballPlayerProfile: PlayerCalculationProfile = {
  unknownPositionName: "?",
  requiresVisibility: false,
  bonusCapRatio: 0.35,
  daysPerSeason: 112,
  growthPrediction: [],
  positionSettings,
};
