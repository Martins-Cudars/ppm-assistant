import { RelativeSkillFit } from "@/base/relativeSkillFit";
import { GrowthPrediction } from "@/types/GrowthData";
import { Sport } from "@/types/Sport";

export type PlayerPositionRule = {
  name: string;
  ratios: object;
  bonus?: object;
  trainingRatios?: object;
  trainingBonus?: object;
  positionRatio: number;
};

export type PlayerCalculationProfile = {
  unknownPositionName: string;
  requiresVisibility: boolean;
  bonusCapRatio?: number;
  daysPerSeason: number;
  sport: Sport;
  /** The fitted global relative-skill line (scripts/fit-relative-skill.ts). */
  relativeSkillFit: RelativeSkillFit;
  /** The same line as a table: relative skill's global 100% per age. */
  relativeSkillReference: GrowthPrediction;
  positionSettings: PlayerPositionRule[];
};
