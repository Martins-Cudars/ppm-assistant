import { RelativeSkillReference } from "@/types/GrowthData";

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
  /** The 100% lines behind relative skill (scripts/fit-relative-skill.ts). */
  relativeSkillReference: RelativeSkillReference;
  positionSettings: PlayerPositionRule[];
};
