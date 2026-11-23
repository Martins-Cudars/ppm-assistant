import { SoccerPositionSetting } from "@/types/Position";

enum Ratio {
  main = 1,
  high = 0.75,
  medium = 0.5,
  low = 0.25,
  forwardShooting = 0.2,
  midfieldShooting = 0.15,
  verylow = 0.1,
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
      shooting: Ratio.midfieldShooting,
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
      shooting: Ratio.midfieldShooting,
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
      shooting: Ratio.forwardShooting,
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
      shooting: Ratio.forwardShooting,
    },
    positionRatio: 1,
  },
];

const ratingSettings = {
  low: 400,
  medium: 800,
  high: 1200,
};


export { positionSettings, ratingSettings };
