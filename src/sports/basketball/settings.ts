import { BasketballPositionSetting, RatingSettings } from "@/types/Position";

enum Ratio {
  verylow = 0.2,
  low = 0.4,
  medium = 0.6,
  high = 0.8,
  veryhigh = 1,
}

const positionSettings: BasketballPositionSetting[] = [
  {
    name: "PG",
    ratios: {
      passing: Ratio.veryhigh,
      technical: Ratio.high,
      speed: Ratio.high,
      aggression: Ratio.verylow,
      jumping: Ratio.verylow,
    },
    trainingRatios: {
      passing: 100,
      technical: 80,
      speed: 80,
      aggression: 20,
      jumping: 20,
    },
    trainingBonus: {
      shooting: 60,
      blocking: 20,
    },
    minHeight: 175,
    maxHeight: 190,
    positionRatio: 1,
  },
  {
    name: "SG",
    ratios: {
      passing: Ratio.high,
      technical: Ratio.high,
      speed: Ratio.medium,
      aggression: Ratio.low,
      jumping: Ratio.low,
    },
    trainingRatios: {
      passing: 80,
      technical: 80,
      speed: 60,
      aggression: 40,
      jumping: 40,
    },
    trainingBonus: {
      shooting: 80,
      blocking: 40,
    },
    minHeight: 185,
    maxHeight: 200,
    positionRatio: 1,
  },
  {
    name: "SF",
    ratios: {
      passing: Ratio.medium,
      technical: Ratio.medium,
      speed: Ratio.medium,
      aggression: Ratio.medium,
      jumping: Ratio.medium,
    },
    trainingRatios: {
      passing: 60,
      technical: 60,
      speed: 60,
      aggression: 60,
      jumping: 60,
    },
    trainingBonus: {
      shooting: 60,
      blocking: 40,
    },
    minHeight: 190,
    maxHeight: 205,
    positionRatio: 1,
  },
  {
    name: "PF",
    ratios: {
      passing: Ratio.low,
      technical: Ratio.low,
      speed: Ratio.medium,
      aggression: Ratio.high,
      jumping: Ratio.high,
    },
    trainingRatios: {
      passing: 40,
      technical: 40,
      speed: 60,
      aggression: 80,
      jumping: 80,
    },
    trainingBonus: {
      shooting: 40,
      blocking: 60,
    },
    minHeight: 200,
    maxHeight: 215,
    positionRatio: 1,
  },
  {
    name: "C",
    ratios: {
      passing: Ratio.verylow,
      technical: Ratio.low,
      speed: Ratio.low,
      aggression: Ratio.veryhigh,
      jumping: Ratio.veryhigh,
    },
    trainingRatios: {
      passing: 20,
      technical: 40,
      speed: 40,
      aggression: 100,
      jumping: 100,
    },
    trainingBonus: {
      shooting: 20,
      blocking: 80,
    },
    minHeight: 205,
    maxHeight: 220,
    positionRatio: 1,
  },
];

const ratingSettings: RatingSettings = {
  low: 300,
  medium: 600,
  high: 900,
};

export { positionSettings, ratingSettings };
