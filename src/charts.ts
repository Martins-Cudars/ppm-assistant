import Chart from "chart.js/auto";
import { ChartConfiguration } from "chart.js";
import { playerGrowthPrediction } from "@/sports/hockey/settings";
import { calculateSkillWithExp } from "@/base/calculations";
import {
  getCurrentSeasonDay,
  calculateSeasonProgress,
  recalculatePredictDataAccordingToSeasonDay,
} from "@/utils";

import { ChartData } from "@/types/Chart";

// TODO: Improve calculations by using player age, career longitivity, current training level, etc.

const renderPotentialChart = (data: ChartData, el: HTMLCanvasElement) => {
  const predictData = recalculatePredictDataAccordingToSeasonDay(
    playerGrowthPrediction,
    data.position
  );

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

  const chart = new Chart(el, chartConfig as ChartConfiguration);
  chart.resize(590, 300);

  return chart;
};

export { renderPotentialChart };
