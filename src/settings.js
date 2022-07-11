const positionSettings = [
  {
    name: "Goalie",
    ratios: {
      goalie: 1,
      technical: 0.5,
      passing: 0.5,
    },
  },
  {
    name: "Defence",
    ratios: {
      defence: 1,
      passing: 0.5,
      aggression: 0.5,
    },
  },
  {
    name: "Winger",
    ratios: {
      offence: 1,
      technical: 0.5,
      aggression: 0.5,
    },
  },
  {
    name: "Center",
    ratios: {
      offence: 1,
      technical: 0.5,
      passing: 0.5,
    },
  },
];

const ratingSettings = {
  low: 500,
  medium: 1000,
  high: 1500,
};

export { positionSettings, ratingSettings };
