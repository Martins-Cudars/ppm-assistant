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

const playerGrowthPrediction = [
  { age: 15, skill: 90, exp: 0 },
  { age: 16, skill: 175, exp: 6 },
  { age: 17, skill: 250, exp: 12 },
  { age: 18, skill: 315, exp: 18 },
  { age: 19, skill: 370, exp: 26 },
  { age: 20, skill: 415, exp: 34 },
  { age: 21, skill: 450, exp: 45 },
  { age: 22, skill: 480, exp: 56 },
  { age: 23, skill: 505, exp: 67 },
  { age: 24, skill: 525, exp: 78 },
  { age: 25, skill: 540, exp: 89 },
  { age: 26, skill: 552, exp: 100 },
  { age: 27, skill: 561, exp: 111 },
  { age: 28, skill: 568, exp: 122 },
  { age: 29, skill: 573, exp: 135 },
  { age: 30, skill: 576, exp: 148 },
  { age: 31, skill: 576, exp: 161 },
  { age: 32, skill: 576, exp: 174 },
  { age: 33, skill: 576, exp: 187 },
  { age: 34, skill: 573, exp: 200 },
  { age: 35, skill: 565, exp: 213 },
  { age: 36, skill: 552, exp: 226 },
  { age: 37, skill: 533, exp: 239 },
  { age: 38, skill: 508, exp: 252 },
  { age: 39, skill: 477, exp: 265 },
  { age: 40, skill: 440, exp: 278 },
];

export { positionSettings, ratingSettings, playerGrowthPrediction };
