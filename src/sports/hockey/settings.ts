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
  },
];

const ratingSettings: RatingSettings = {
  low: 500,
  medium: 1000,
  high: 1500,
};

const playerGrowthPrediction: GrowthPrediction = [
  { age: 15, skill: 87, exp: 8 },
  { age: 16, skill: 170, exp: 16 },
  { age: 17, skill: 252, exp: 24 },
  { age: 18, skill: 335, exp: 32 },
  { age: 19, skill: 417, exp: 42 },
  { age: 20, skill: 486, exp: 52 },
  { age: 21, skill: 555, exp: 62 },
  { age: 22, skill: 623, exp: 72 },
  { age: 23, skill: 692, exp: 84 },
  { age: 24, skill: 747, exp: 96 },
  { age: 25, skill: 802, exp: 108 },
  { age: 26, skill: 857, exp: 120 },
  { age: 27, skill: 912, exp: 134 },
  { age: 28, skill: 953, exp: 148 },
  { age: 29, skill: 995, exp: 162 },
  { age: 30, skill: 1036, exp: 176 },
  { age: 31, skill: 1063, exp: 192 },
  { age: 32, skill: 1091, exp: 208 },
  { age: 33, skill: 1118, exp: 224 },
  { age: 34, skill: 1146, exp: 240 },
  { age: 35, skill: 1159, exp: 256 },
  { age: 36, skill: 1143, exp: 272 },
  { age: 37, skill: 1121, exp: 288 },
  { age: 38, skill: 1095, exp: 304 },
  { age: 39, skill: 1060, exp: 320 },
  { age: 40, skill: 1020, exp: 336 },
];

export { positionSettings, ratingSettings, playerGrowthPrediction };
