import { SoccerPositionSetting } from "@/types/Position";

enum Ratio {
  main = 1,
  high = 0.75,
  medium = 0.5,
  low = 0.25,
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
      shooting: Ratio.low,
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
    bonus: {
      shooting: Ratio.low,
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
    bonus: {
      shooting: Ratio.medium,
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
    bonus: {
      shooting: Ratio.medium,
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
    bonus: {
      shooting: Ratio.high,
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
    bonus: {
      shooting: Ratio.high,
    },
  },
];

const ratingSettings = {
  low: 300,
  medium: 600,
  high: 900,
};

const getSkillAndExpIncrement = (
  age: number
): { skillIncrement: number; expIncrement: number } => {
  if (age <= 18) {
    return { skillIncrement: 65, expIncrement: 6 };
  } else if (age <= 21) {
    return { skillIncrement: 55, expIncrement: 8 };
  } else if (age <= 24) {
    return { skillIncrement: 40, expIncrement: 10 };
  } else if (age <= 27) {
    return { skillIncrement: 30, expIncrement: 10 };
  } else if (age <= 30) {
    return { skillIncrement: 0, expIncrement: 12 };
  } else if (age <= 32) {
    return { skillIncrement: -10, expIncrement: 12 };
  } else if (age <= 35) {
    return { skillIncrement: -20, expIncrement: 12 };
  } else {
    return { skillIncrement: -20, expIncrement: 12 };
  }
};

const generatePlayerGrowthData = () => {
  const playerGrowthData = [];
  let skill = 30;
  let exp = 0;

  for (let age = 15; age <= 40; age++) {
    const { skillIncrement, expIncrement } = getSkillAndExpIncrement(age);
    skill += skillIncrement;
    exp += expIncrement;

    // Cap the skill at 655
    if (skill > 655) skill = 655;

    playerGrowthData.push({ age, skill, exp });
  }

  return playerGrowthData;
};

const playerGrowthPrediction = generatePlayerGrowthData();

export { positionSettings, ratingSettings, playerGrowthPrediction };
