enum Ratio {
  main = 1,
  high = 0.75,
  medium = 0.5,
  low = 0.25,
}

interface PositionSetting {
  name: "GK" | "SD" | "CD" | "SM" | "CM" | "SF" | "CF";
  ratios: {
    goalie?: number;
    defence?: number;
    midfield?: number;
    offence?: number;
    technical?: number;
    speed?: number;
    passing?: number;
    heading?: number;
  };
}

const positionSettings: PositionSetting[] = [
  {
    name: "GK",
    ratios: {
      goalie: Ratio.main,
      technical: Ratio.high,
      speed: Ratio.high,
      passing: Ratio.low,
      heading: Ratio.low,
    },
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
  },
];

const ratingSettings = {
  low: 300,
  medium: 600,
  high: 900,
};

export { positionSettings, ratingSettings };
