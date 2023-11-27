import { GrowthPrediction } from "@/types/GrowthData";

export const getCurrentSeasonDay = () => {
  const teamInfoEl = document.querySelector(".top_info_team");

  if (!teamInfoEl) {
    console.error("error getting current season day");
    return 1;
  }

  const dayEl = teamInfoEl.querySelectorAll(".link_r");

  const dayString = dayEl[dayEl.length - 1].textContent;

  if (!dayString) {
    console.error("error getting current season day");
    return 1;
  }

  const regex = /\((\d+)\//g;
  const match = regex.exec(dayString);

  if (!match || !match[1]) {
    console.error("error getting current season day");
    return 1;
  }

  return parseInt(match[1]);
};

export const calculateSeasonProgress = (seasonDay: number) => {
  return seasonDay / 112;
};

export const recalculatePredictDataAccordingToSeasonDay = (
  playerGrowthPrediction: GrowthPrediction,
  position?: string,
  day?: number
) => {
  const seasonDay = day || 1;
  const seasonProgress = calculateSeasonProgress(seasonDay);

  let positionRatio = 1;

  // adjust ratio for Goalies, because they only need 2 skill points per ability compared to
  // other positions which need 2.5 skill points per ability
  if (position && position === "G") {
    positionRatio = 1.25;
  }

  const predictData = playerGrowthPrediction.map((row) => {
    return {
      ...row,
      skill: Math.round(row.skill * positionRatio),
    };
  });

  const newPredictData = predictData.map((row) => {
    const newSkill = Math.round(
      row.skill +
        seasonProgress *
          (predictData[row.age - 14]
            ? predictData[row.age - 14].skill - row.skill
            : -40)
    );

    const newExp = Math.round(
      row.exp +
        seasonProgress *
          (predictData[row.age - 14]
            ? predictData[row.age - 14].exp - row.exp
            : 10)
    );

    return {
      age: row.age,
      skill: newSkill,
      exp: newExp,
    };
  });

  return newPredictData;
};
