const positionSettings = [
  {
    name: "PG",
    ratios: {
      goalie: 1,
      technical: 0.5,
      passing: 0.5,
    },
  },
  {
    name: "SG",
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
    name: "SF",
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
    name: "PF",
    ratios: {
      offence: 1,
      technical: 0.5,
      passing: 0.5,
    },
    bonus: {
      shooting: 0.5,
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
