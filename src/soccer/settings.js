const positionSettings = [
  {
    name: "GK",
    ratios: {
      goalie: 1,
      technical: 0.75,
      speed: 0.75,
      passing: 0.25,
      heading: 0.25,
    },
  },
  {
    name: "D",
    ratios: {
      defence: 1,
      technical: 0.5,
      speed: 0.75,
      passing: 0.5,
      heading: 0.25,
    },
  },
  {
    name: "CD",
    ratios: {
      defence: 1,
      technical: 0.5,
      speed: 0.5,
      passing: 0.5,
      heading: 0.5,
    },
  },
  {
    name: "M",
    ratios: {
      midfield: 1,
      technical: 0.5,
      speed: 0.75,
      passing: 0.5,
      heading: 0.25,
    },
  },
  {
    name: "CM",
    ratios: {
      midfield: 1,
      technical: 0.75,
      speed: 0.25,
      passing: 0.75,
      heading: 0.25,
    },
  },
  {
    name: "F",
    ratios: {
      offence: 1,
      technical: 0.75,
      speed: 0.75,
      passing: 0.5,
      heading: 0.25,
    },
  },
  {
    name: "CF",
    ratios: {
      offence: 1,
      technical: 0.5,
      speed: 0.75,
      passing: 0.25,
      heading: 0.25,
    },
  },
];

const ratingSettings = {
  low: 300,
  medium: 600,
  high: 900,
};

export { positionSettings, ratingSettings };
