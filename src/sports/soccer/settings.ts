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

const generatePlayerGrowthData = () => {
  const playerGrowthData = [];
  let skill = 80;
  let exp = 0;

  for (let age = 15; age <= 40; age++) {
    if (age <= 18) {
      skill = skill + 60;
      exp = exp + 6;
    } else if (age <= 21) {
      skill = skill + 50;
      exp = exp + 8;
    } else if (age <= 24) {
      skill = skill + 40;
      exp = exp + 10;
    } else if (age <= 27) {
      skill = skill + 30;
      exp = exp + 10;
    } else if (age <= 30) {
      skill = skill + 15;
      exp = exp + 12;
    } else if (age <= 35) {
      skill = skill - 10;
      exp = exp + 12;
    } else {
      skill = skill - 20;
      exp = exp + 12;
    }

    if (skill > 655) skill = 655;
    playerGrowthData.push({ age, skill, exp });
  }

  return playerGrowthData;
};

const playerGrowthPrediction = generatePlayerGrowthData();
console.log(playerGrowthPrediction);

export { positionSettings, ratingSettings, playerGrowthPrediction };
