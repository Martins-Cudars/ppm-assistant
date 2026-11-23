import { HockeyPositionSetting, RatingSettings } from "@/types/Position";

enum Ratio {
  main = 1,
  veryhigh = 0.75,
  high = 0.5,
  medium = 0.25,
}

const positionSettings: HockeyPositionSetting[] = [
  {
    name: "G",
    ratios: {
      goalie: Ratio.main,
      technical: Ratio.high,
      passing: Ratio.high,
    },
    trainingRatios: {
      goalie: 100,
      passing: 50,
      technical: 50,
    },
    positionRatio: 0.73,
  },
  {
    name: "D",
    ratios: {
      defence: Ratio.main,
      passing: Ratio.high,
      aggression: Ratio.high,
    },
    bonus: {
      shooting: 0.25,
      technical: 0.25,
      offence: 0.1,
    },
    trainingRatios: {
      defence: 100,
      passing: 50,
      aggression: 50,
    },
    trainingBonus: {
      shooting: 5,
      technical: 25,
    },
    positionRatio: 0.85,
  },
  {
    name: "W",
    ratios: {
      offence: Ratio.main,
      technical: Ratio.high,
      aggression: Ratio.high,
    },
    bonus: {
      shooting: 0.45,
      defence: 0.1,
    },
    trainingRatios: {
      offence: 100,
      technical: 50,
      aggression: 50,
    },
    trainingBonus: {
      shooting: 75,
    },
    positionRatio: 1.0,
  },
  {
    name: "C",
    ratios: {
      offence: Ratio.main,
      technical: Ratio.high,
      passing: Ratio.high,
    },
    bonus: {
      shooting: 0.45,
      defence: 0.1,
    },
    trainingRatios: {
      offence: 100,
      passing: 50,
      technical: 50,
    },
    trainingBonus: {
      shooting: 75,
    },
    positionRatio: 1.0,
  },
];

const ratingSettings: RatingSettings = {
  low: 600,
  medium: 1500,
  high: 2600,
};


export { positionSettings, ratingSettings };
