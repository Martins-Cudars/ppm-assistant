import { GrowthPrediction } from "@/types/GrowthData";
import { SoccerPositionSetting } from "@/types/Position";

enum Ratio {
  verylow = 0.1,
  main = 1,
  high = 0.75,
  medium = 0.5,
  low = 0.25,
}

const positionSettings: SoccerPositionSetting[] = [
  {
    name: "GK",
    ratios: {
      goalie: Ratio.main,
      technical: Ratio.high,
      speed: Ratio.high,
      passing: Ratio.low,
      heading: Ratio.low,
    },
    positionRatio: 1,
  },
  {
    name: "SD",
    ratios: {
      defence: Ratio.main,
      technical: Ratio.medium,
      speed: Ratio.high,
      passing: Ratio.medium,
      heading: Ratio.low,
    },
    bonus: {
      midfield: Ratio.verylow,
      shooting: Ratio.verylow,
    },
    positionRatio: 1,
  },
  {
    name: "CD",
    ratios: {
      defence: Ratio.main,
      technical: Ratio.medium,
      speed: Ratio.medium,
      passing: Ratio.medium,
      heading: Ratio.medium,
    },
    bonus: {
      midfield: Ratio.verylow,
      shooting: Ratio.verylow,
    },
    positionRatio: 1,
  },
  {
    name: "SM",
    ratios: {
      midfield: Ratio.main,
      technical: Ratio.medium,
      speed: Ratio.high,
      passing: Ratio.medium,
      heading: Ratio.low,
    },
    bonus: {
      defence: Ratio.verylow,
      offence: Ratio.verylow,
      shooting: Ratio.low,
    },
    positionRatio: 1,
  },
  {
    name: "CM",
    ratios: {
      midfield: Ratio.main,
      technical: Ratio.high,
      speed: Ratio.low,
      passing: Ratio.high,
      heading: Ratio.low,
    },
    bonus: {
      defence: Ratio.verylow,
      offence: Ratio.verylow,
      shooting: Ratio.low,
    },
    positionRatio: 1,
  },
  {
    name: "SF",
    ratios: {
      offence: Ratio.main,
      technical: Ratio.high,
      speed: Ratio.high,
      passing: Ratio.medium,
      heading: Ratio.low,
    },
    bonus: {
      midfield: Ratio.verylow,
      shooting: Ratio.medium,
    },
    positionRatio: 1,
  },
  {
    name: "CF",
    ratios: {
      offence: Ratio.main,
      technical: Ratio.medium,
      speed: Ratio.high,
      passing: Ratio.low,
      heading: Ratio.low,
    },
    bonus: {
      midfield: Ratio.verylow,
      shooting: Ratio.medium,
    },
    positionRatio: 1,
  },
];

const ratingSettings = {
  low: 400,
  medium: 800,
  high: 1200,
};

const playerGrowthPrediction: GrowthPrediction = [
  { age: 15, skill: 120, exp: 0 },
  { age: 16, skill: 182, exp: 5 }, // +62 skill | +5 exp
  { age: 17, skill: 250, exp: 10 }, // +68 skill | +5 exp
  { age: 18, skill: 318, exp: 16 }, // +68 skill | +6 exp
  { age: 19, skill: 385, exp: 22 }, // +67 skill | +6 exp
  { age: 20, skill: 455, exp: 35 }, // +70 skill | +13 exp
  { age: 21, skill: 525, exp: 48 }, // +70 skill | +13 exp
  { age: 22, skill: 590, exp: 62 }, // +65 skill | +14 exp
  { age: 23, skill: 650, exp: 77 }, // +60 skill | +15 exp
  { age: 24, skill: 700, exp: 93 }, // +50 skill | +16 exp
  { age: 25, skill: 720, exp: 110 }, // +20 skill | +17 exp
  { age: 26, skill: 735, exp: 128 }, // +15 skill | +18 exp
  { age: 27, skill: 745, exp: 147 }, // +10 skill | +19 exp
  { age: 28, skill: 752, exp: 167 }, // +7 skill | +20 exp
  { age: 29, skill: 757, exp: 188 }, // +5 skill | +21 exp
  { age: 30, skill: 760, exp: 210 }, // +3 skill | +22 exp
  { age: 31, skill: 760, exp: 225 }, // +0 skill | +15 exp
  { age: 32, skill: 758, exp: 238 }, // -2 skill | +13 exp
  { age: 33, skill: 755, exp: 247 }, // -3 skill | +9 exp
  { age: 34, skill: 750, exp: 255 }, // -5 skill | +8 exp
  { age: 35, skill: 742, exp: 262 }, // -8 skill | +7 exp
  { age: 36, skill: 730, exp: 268 }, // -12 skill | +6 exp
  { age: 37, skill: 715, exp: 273 }, // -15 skill | +5 exp
  { age: 38, skill: 695, exp: 277 }, // -20 skill | +4 exp
  { age: 39, skill: 670, exp: 280 }, // -25 skill | +3 exp
  { age: 40, skill: 640, exp: 282 }, // -30 skill | +2 exp
];

export { positionSettings, ratingSettings, playerGrowthPrediction };
