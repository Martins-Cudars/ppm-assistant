import { PlayerCalculationProfile } from "@/classes/playerProfile";
import { positionSettings } from "./settings";
import { relativeSkillReference } from "./relativeSkillReference";

export const hockeyPlayerProfile: PlayerCalculationProfile = {
  unknownPositionName: "?",
  requiresVisibility: true,
  bonusCapRatio: 0.6,
  daysPerSeason: 112,
  relativeSkillReference,
  positionSettings,
};
