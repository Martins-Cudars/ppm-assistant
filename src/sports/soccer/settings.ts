const ratios = {
  main: 1,
  high: 0.75,
  medium: 0.5,
  low: 0.25,
};

const positionSettings = [
  {
    name: "GK",
    ratios: {
      goalie: ratios.main,
      technical: ratios.high,
      speed: ratios.high,
      passing: ratios.low,
      heading: ratios.low,
    },
  },
  {
    name: "SD",
    ratios: {
      defence: ratios.main,
      technical: ratios.medium,
      speed: ratios.high,
      passing: ratios.medium,
      heading: ratios.low,
    },
  },
  {
    name: "CD",
    ratios: {
      defence: ratios.main,
      technical: ratios.medium,
      speed: ratios.medium,
      passing: ratios.medium,
      heading: ratios.medium,
    },
  },
  {
    name: "SM",
    ratios: {
      midfield: ratios.main,
      technical: ratios.medium,
      speed: ratios.high,
      passing: ratios.medium,
      heading: ratios.low,
    },
  },
  {
    name: "CM",
    ratios: {
      midfield: ratios.main,
      technical: ratios.high,
      speed: ratios.low,
      passing: ratios.high,
      heading: ratios.low,
    },
  },
  {
    name: "SF",
    ratios: {
      offence: ratios.main,
      technical: ratios.high,
      speed: ratios.high,
      passing: ratios.medium,
      heading: ratios.low,
    },
  },
  {
    name: "CF",
    ratios: {
      offence: ratios.main,
      technical: ratios.medium,
      speed: ratios.high,
      passing: ratios.low,
      heading: ratios.low,
    },
  },
];

const ratingSettings = {
  low: 300,
  medium: 600,
  high: 900,
};

export { positionSettings, ratingSettings };
