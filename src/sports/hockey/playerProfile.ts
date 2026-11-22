import { PlayerCalculationProfile } from "@/classes/playerProfile";
import { positionSettings } from "./settings";
import { relativeSkillFit, relativeSkillReference } from "./relativeSkillReference";

export const hockeyPlayerProfile: PlayerCalculationProfile = {
  unknownPositionName: "?",
  requiresVisibility: true,
  bonusCapRatio: 0.6,
  daysPerSeason: 112,
  sport: "hockey",
  relativeSkillFit,
  relativeSkillReference,
  positionSettings,
};
