const positionSettings = [
  {
    name: "G",
    ratios: {
      goalie: 1,
      technical: 0.5,
      passing: 0.5,
    },
  },
  {
    name: "D",
    ratios: {
      defence: 1,
      passing: 0.5,
      aggression: 0.5,
    },
    bonus: {
      technical: 0.5,
    },
  },
  {
    name: "W",
    ratios: {
      offence: 1,
      technical: 0.5,
      aggression: 0.5,
    },
    bonus: {
      shooting: 0.75,
    },
  },
  {
    name: "C",
    ratios: {
      offence: 1,
      technical: 0.5,
      passing: 0.5,
    },
    bonus: {
      shooting: 0.5,
    },
  },
];

const ratingSettings = {
  low: 500,
  medium: 1000,
  high: 1500,
};

export { positionSettings, ratingSettings };
