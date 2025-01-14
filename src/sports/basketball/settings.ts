enum Ratio {
  verylow = 0.2,
  low = 0.4,
  medium = 0.6,
  high = 0.8,
  veryhigh = 1,
}

interface PositionSetting {
  name: "PG" | "SG" | "SF" | "PF" | "C";
  ratios: {
    shooting?: number;
    blocking?: number;
    passing?: number;
    technical?: number;
    speed?: number;
    aggression?: number;
    jumping?: number;
  };
  bonus?: {
    shooting?: number;
    blocking?: number;
  };
  minHeight: number;
  maxHeight: number;
  positionRatio: number;
}

const positionSettings: PositionSetting[] = [
  {
    name: "PG",
    ratios: {
      passing: Ratio.veryhigh,
      technical: Ratio.high,
      speed: Ratio.high,
      aggression: Ratio.verylow,
      jumping: Ratio.verylow,
    },
    bonus: {
      shooting: Ratio.medium,
      blocking: Ratio.verylow,
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
    bonus: {
      shooting: Ratio.high,
      blocking: Ratio.low,
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
    bonus: {
      shooting: Ratio.medium,
      blocking: Ratio.low,
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
    bonus: {
      shooting: Ratio.low,
      blocking: Ratio.medium,
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
    bonus: {
      shooting: Ratio.verylow,
      blocking: Ratio.high,
    },
    minHeight: 205,
    maxHeight: 220,
    positionRatio: 1,
  },
];

const ratingSettings = {
  low: 300,
  medium: 600,
  high: 900,
};

export { positionSettings, ratingSettings };
