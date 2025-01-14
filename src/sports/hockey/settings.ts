import { HockeyPositionSetting, RatingSettings } from "@/types/Position";
import { GrowthPrediction } from "@/types/GrowthData";

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
      technical: Ratio.high,
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
      shooting: Ratio.veryhigh,
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
      shooting: Ratio.high,
    },
    positionRatio: 1.0,
  },
];

const ratingSettings: RatingSettings = {
  low: 500,
  medium: 1000,
  high: 1500,
};

const playerGrowthPrediction: GrowthPrediction = [
  { age: 15, skill: 87, exp: 0 },
  { age: 16, skill: 170, exp: 8 },
  { age: 17, skill: 252, exp: 16 },
  { age: 18, skill: 335, exp: 24 },
  { age: 19, skill: 417, exp: 34 },
  { age: 20, skill: 486, exp: 44 },
  { age: 21, skill: 555, exp: 54 },
  { age: 22, skill: 623, exp: 64 },
  { age: 23, skill: 692, exp: 76 },
  { age: 24, skill: 747, exp: 88 },
  { age: 25, skill: 802, exp: 100 },
  { age: 26, skill: 857, exp: 112 },
  { age: 27, skill: 912, exp: 126 },
  { age: 28, skill: 953, exp: 140 },
  { age: 29, skill: 995, exp: 154 },
  { age: 30, skill: 1036, exp: 168 },
  { age: 31, skill: 1063, exp: 184 },
  { age: 32, skill: 1091, exp: 200 },
  { age: 33, skill: 1118, exp: 216 },
  { age: 34, skill: 1146, exp: 232 },
  { age: 35, skill: 1159, exp: 248 },
  { age: 36, skill: 1143, exp: 264 },
  { age: 37, skill: 1121, exp: 280 },
  { age: 38, skill: 1095, exp: 296 },
  { age: 39, skill: 1060, exp: 312 },
  { age: 40, skill: 1020, exp: 328 },
];

export { positionSettings, ratingSettings, playerGrowthPrediction };
