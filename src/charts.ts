import Chart from "chart.js/auto";
import { playerGrowthPrediction } from "@/sports/hockey/settings";
import { calculateSkillWithExp } from "@/base/calculations";

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

// TODO: Refactor this function
// this might be unnecessary code, it's current only use is to adjust the ratio for Goalies
const recalculatePredictDataAccordingToSeasonDay = (position = null) => {
  const seasonDay = 1;
  const seasonProgress = calculateSeasonProgress(seasonDay);

  console.log(`current seasonProgress: ${seasonProgress}`);

  let positionRatio = 1;

  console.log(position);

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

  console.log(newPredictData);

  return newPredictData;
};

const renderPotentialChart = (data, el) => {
  const predictData = recalculatePredictDataAccordingToSeasonDay(data.position);

  const seasonDay = getCurrentSeasonDay();
  const seasonProgress = calculateSeasonProgress(seasonDay);

  const playerSkillArr = [];
  const playerSkillExpArr = [];

  playerSkillArr.push({
    x: Math.round((data.age + seasonProgress) * 10) / 10,
    y: data.skill,
  });
  playerSkillExpArr.push({
    x: Math.round((data.age + seasonProgress) * 10) / 10,
    y: calculateSkillWithExp(data.skill, data.exp),
  });

  console.log(playerSkillArr);

  console.log(
    predictData.map((row) => {
      return { x: row.age, y: row.skill };
    })
  );

  const chartConfig = {
    type: "line",
    options: {
      responsive: false,
      scales: {
        x: {
          type: "linear",
          title: {
            display: true,
            text: "Age",
          },
          min: 15,
          max: 40,

          ticks: {
            stepSize: 1,
          },
        },
      },
    },
    data: {
      // labels: predictData.map((row) => parseInt(row.age)),
      datasets: [
        {
          label: "Perfect Player Skill",
          data: predictData.map((row) => {
            return { x: row.age, y: row.skill };
          }),
          backgroundColor: "rgba(56, 50, 58, 0.5)",
          pointBackgroundColor: "rgba(56, 50, 58, 0.5)",
        },
        {
          label: "Perfect Player Skill With Exp",
          data: predictData.map((row) => {
            return { x: row.age, y: calculateSkillWithExp(row.skill, row.exp) };
          }),
          backgroundColor: "rgba(29, 27, 29, 0.5)",
          pointBackgroundColor: "rgba(29, 27, 29, 0.5)",
        },
        {
          label: "This player",
          data: playerSkillArr,
          backgroundColor: "rgba(255, 0, 4, 0.35)",
          pointBackgroundColor: "rgba(255, 0, 4, 0.35)",
          pointStyle: "circle",
          borderColor: "rgba(255, 0, 4, 0.35)",
          pointRadius: 8,
        },
        {
          label: "This player With Exp",
          data: playerSkillExpArr,
          backgroundColor: "rgba(255, 0, 4, 0.9)",
          pointBackgroundColor: "rgba(255, 0, 4, 0.9)",
          pointStyle: "circle",
          borderColor: "rgba(255, 0, 4, 0.9)",
          pointRadius: 8,
        },
      ],
    },
  };

  const chart = new Chart(el, chartConfig);
  chart.resize(590, 300);

  return chart;
};

export { renderPotentialChart };
