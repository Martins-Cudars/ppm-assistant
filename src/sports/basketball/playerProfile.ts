import { PlayerCalculationProfile } from "@/classes/playerProfile";
import { positionSettings } from "./settings";

export const basketballPlayerProfile: PlayerCalculationProfile = {
  unknownPositionName: "?",
  requiresVisibility: false,
  daysPerSeason: 112,
  growthPrediction: [],
  positionSettings,
};
