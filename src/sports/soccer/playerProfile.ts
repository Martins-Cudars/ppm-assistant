import { PlayerCalculationProfile } from "@/classes/playerProfile";
import { positionSettings } from "./settings";
import { relativeSkillReference } from "./relativeSkillReference";

export const soccerPlayerProfile: PlayerCalculationProfile = {
  unknownPositionName: "?",
  requiresVisibility: false,
  bonusCapRatio: 0.35,
  daysPerSeason: 112,
  relativeSkillReference,
  positionSettings,
};
