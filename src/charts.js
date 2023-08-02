import Chart from "chart.js/auto";
import { playerGrowthPrediction } from "~/src/hockey/settings.js";
import { calculateSkillWithExp } from "~/src/calculations.js";

// TODO: Improve calculations by using player age, career longitivity, current training level, etc.

const getCurrentSeasonDay = () => {
  const teamInfoEl = document.querySelector(".top_info_team");
  const dayEl = teamInfoEl.querySelectorAll(".link_r");

  const dayString = dayEl[dayEl.length - 1].textContent;
  const regex = /\((\d+)\//g;
  const match = regex.exec(dayString);

  if (!match || !match[1]) {
    console.log("error getting current season day");
    return 1;
  }

  console.log(`current season day: ${match[1]}`);
  return parseInt(match[1]);
};

const calculateSeasonProgress = (seasonDay) => {
  return seasonDay / 112;
};

const recalculatePredictDataAccordingToSeasonDay = () => {
  const seasonDay = getCurrentSeasonDay();
  const seasonProgress = calculateSeasonProgress(seasonDay);
  const predictData = playerGrowthPrediction;

  const newPredictData = predictData.map((row) => {
    const newSkill = Math.round(
      row.skill +
        seasonProgress *
          (predictData[row.age - 14]
            ? predictData[row.age - 14].skill - row.skill
            : 0)
    );

    const newExp = Math.round(
      row.exp +
        seasonProgress *
          (predictData[row.age - 14]
            ? predictData[row.age - 14].exp - row.exp
            : 0)
    );

    return {
      age: row.age,
      skill: newSkill,
      exp: newExp,
    };
  });

  console.log(newPredictData);

  return newPredictData;
};

const renderPotentialChart = (data, el, seasonDay = 1) => {
  const predictData = recalculatePredictDataAccordingToSeasonDay(data.age);

  const playerSkillArr = [];
  const playerSkillExpArr = [];

  for (i = 15; i < 41; i++) {
    if (data.age === i) {
      playerSkillArr.push(data.skill);
      playerSkillExpArr.push(calculateSkillWithExp(data.skill, data.exp));
    } else {
      playerSkillArr.push(null);
      playerSkillExpArr.push(null);
    }
  }

  const chartConfig = {
    type: "line",
    data: {
      labels: predictData.map((row) => row.age),
      datasets: [
        {
          label: "Perfect Player Skill",
          data: predictData.map((row) => row.skill),
        },
        {
          label: "Perfect Player Skill With Exp",
          data: predictData.map((row) =>
            calculateSkillWithExp(row.skill, row.exp)
          ),
        },
        {
          label: "This player",
          data: playerSkillArr,
        },
        {
          label: "This player With Exp",
          data: playerSkillExpArr,
        },
      ],
    },
  };

  return new Chart(el, chartConfig);
};

export { renderPotentialChart };
