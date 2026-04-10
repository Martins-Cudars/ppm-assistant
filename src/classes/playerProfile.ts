import { GrowthPrediction } from "@/types/GrowthData";

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
  growthPrediction: GrowthPrediction;
  positionSettings: PlayerPositionRule[];
};
