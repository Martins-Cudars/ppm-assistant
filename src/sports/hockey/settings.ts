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
  low: 600,
  medium: 1500,
  high: 2600,
};

const playerGrowthPrediction: GrowthPrediction = [
  { age: 15, skill: 110, exp: 0 },
  { age: 16, skill: 204, exp: 9 },
  { age: 17, skill: 319, exp: 19 },
  { age: 18, skill: 436, exp: 28 },
  { age: 19, skill: 551, exp: 39 },
  { age: 20, skill: 649, exp: 51 },
  { age: 21, skill: 746, exp: 63 },
  { age: 22, skill: 841, exp: 74 },
  { age: 23, skill: 938, exp: 88 },
  { age: 24, skill: 1016, exp: 102 },
  { age: 25, skill: 1093, exp: 116 },
  { age: 26, skill: 1171, exp: 130 },
  { age: 27, skill: 1248, exp: 146 },
  { age: 28, skill: 1306, exp: 162 },
  { age: 29, skill: 1365, exp: 178 },
  { age: 30, skill: 1423, exp: 195 },
  { age: 31, skill: 1461, exp: 213 },
  { age: 32, skill: 1500, exp: 232 },
  { age: 33, skill: 1538, exp: 250 },
  { age: 34, skill: 1577, exp: 269 },
  { age: 35, skill: 1596, exp: 287 },
  { age: 36, skill: 1573, exp: 306 },
  { age: 37, skill: 1542, exp: 324 },
  { age: 38, skill: 1506, exp: 343 },
  { age: 39, skill: 1456, exp: 361 },
  { age: 40, skill: 1400, exp: 380 },
  { age: 41, skill: 1335, exp: 398 },
  { age: 42, skill: 1260, exp: 417 },
  { age: 43, skill: 1175, exp: 435 },
  { age: 44, skill: 1080, exp: 454 },
  { age: 45, skill: 975, exp: 472 },
];

export { positionSettings, ratingSettings, playerGrowthPrediction };
