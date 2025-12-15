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
  { age: 15, skill: 120, exp: 0 },
  { age: 16, skill: 240, exp: 9 }, // +120 skill | +9 exp
  { age: 17, skill: 346, exp: 19 }, // +106 skill | +10 exp
  { age: 18, skill: 450, exp: 28 }, // +104 skill | +9 exp
  { age: 19, skill: 551, exp: 39 }, // +101 skill | +11 exp
  { age: 20, skill: 649, exp: 51 }, // +98 skill | +12 exp
  { age: 21, skill: 746, exp: 63 }, // +97 skill | +12 exp
  { age: 22, skill: 841, exp: 74 }, // +95 skill | +11 exp
  { age: 23, skill: 938, exp: 88 }, // +97 skill | +14 exp
  { age: 24, skill: 1016, exp: 102 }, // +78 skill | +14 exp
  { age: 25, skill: 1093, exp: 116 }, // +77 skill | +14 exp
  { age: 26, skill: 1171, exp: 130 }, // +78 skill | +14 exp
  { age: 27, skill: 1248, exp: 146 }, // +77 skill | +16 exp
  { age: 28, skill: 1306, exp: 162 }, // +58 skill | +16 exp
  { age: 29, skill: 1365, exp: 178 }, // +59 skill | +16 exp
  { age: 30, skill: 1423, exp: 195 }, // +58 skill | +17 exp
  { age: 31, skill: 1461, exp: 213 }, // +38 skill | +18 exp
  { age: 32, skill: 1500, exp: 232 }, // +39 skill | +19 exp
  { age: 33, skill: 1538, exp: 250 }, // +38 skill | +18 exp
  { age: 34, skill: 1577, exp: 269 }, // +39 skill | +19 exp
  { age: 35, skill: 1596, exp: 287 }, // +19 skill | +18 exp
  { age: 36, skill: 1573, exp: 306 }, // -23 skill | +19 exp
  { age: 37, skill: 1542, exp: 324 }, // -31 skill | +18 exp
  { age: 38, skill: 1506, exp: 343 }, // -36 skill | +19 exp
  { age: 39, skill: 1456, exp: 361 }, // -50 skill | +18 exp
  { age: 40, skill: 1400, exp: 380 }, // -56 skill | +19 exp
  { age: 41, skill: 1335, exp: 398 }, // -65 skill | +18 exp
  { age: 42, skill: 1260, exp: 417 }, // -75 skill | +19 exp
  { age: 43, skill: 1175, exp: 435 }, // -85 skill | +18 exp
  { age: 44, skill: 1080, exp: 454 }, // -95 skill | +19 exp
  { age: 45, skill: 975, exp: 472 }, // -105 skill | +18 exp
];

export { positionSettings, ratingSettings, playerGrowthPrediction };
