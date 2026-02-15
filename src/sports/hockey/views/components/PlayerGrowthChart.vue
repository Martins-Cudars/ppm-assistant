<template>
  <div class="player-growth-chart">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import Chart from "chart.js/auto";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { playerGrowthPrediction } from "@/sports/hockey/settings";
import { getCurrentSeasonDay } from "@/utils/dom";

const props = defineProps<{
  player: HockeyPlayer;
}>();

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

const calculateData = () => {
  const projectedPureData = [];
  const projectedTotalData = [];
  const currentPureData = [];
  const currentTotalData = [];

  const bestPos = props.player.getBestPosition();
  const currentPureSkill = bestPos.ratingWithBonus;
  const currentTotalSkill = bestPos.ratingWithXp;

  // We loop from 15 to 45
  for (let age = 15; age <= 45; age++) {
    const targetGrowthData = playerGrowthPrediction.find((p) => p.age === age);

    if (targetGrowthData) {
      // Base / Pure skill line
      projectedPureData.push({ x: age, y: targetGrowthData.skill });

      // Total skill line (Skill + Exp bonus)
      const total = Math.round(
        targetGrowthData.skill * (1 + targetGrowthData.exp / 500)
      );
      projectedTotalData.push({ x: age, y: total });
    }
  }

  // Player position
  const seasonDay = getCurrentSeasonDay() || 1;
  const seasonProgress = seasonDay / 112;
  const exactAge = props.player.age + seasonProgress;

  currentPureData.push({ x: exactAge, y: currentPureSkill });
  currentTotalData.push({ x: exactAge, y: currentTotalSkill });

  return {
    projectedPureData,
    projectedTotalData,
    currentPureData,
    currentTotalData,
  };
};

const renderChartWithLogic = () => {
  if (!chartCanvas.value) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  const {
    projectedPureData,
    projectedTotalData,
    currentPureData,
    currentTotalData,
  } = calculateData();

  chartInstance = new Chart(chartCanvas.value, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Top Player Skill (Total)",
          data: projectedTotalData,
          borderColor: "#ccc",
          backgroundColor: "#ccc",
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: "#fff",
          pointBorderColor: "#ccc",
          fill: false,
          tension: 0.4,
        },
        {
          label: "Top Player Skill (Base)",
          data: projectedPureData,
          borderColor: "#ccc",
          backgroundColor: "#ccc",
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: "#fff",
          pointBorderColor: "#ccc",
          fill: false,
          tension: 0.4,
        },
        {
          label: "Current Skill (Total)",
          data: currentTotalData,
          borderColor: "rgba(255, 99, 132, 1)",
          backgroundColor: "rgba(255, 99, 132, 0.5)",
          pointRadius: 10,
          pointHoverRadius: 12,
          showLine: false,
        },
        {
          label: "Current Skill (Base)",
          data: currentPureData,
          borderColor: "rgba(255, 99, 132, 1)",
          backgroundColor: "rgba(255, 99, 132, 1)",
          pointRadius: 10,
          pointHoverRadius: 12,
          showLine: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Skill",
          },
        },
        x: {
          type: "linear",
          min: 15,
          max: 45,
          title: {
            display: true,
            text: "Age",
          },
          ticks: {
            stepSize: 1,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          mode: "index",
          intersect: false,
        },
      },
    },
  });
};

onMounted(() => {
  renderChartWithLogic();
});

watch(
  () => props.player,
  () => {
    renderChartWithLogic();
  },
  { deep: true }
);
</script>

<style scoped>
.player-growth-chart {
  width: 100%;
  height: 400px;
  background: #fff;
  padding: 20px;
  margin-top: 20px;
  border: 1px solid #c9c9c9;
  border-radius: 5px;
  box-sizing: border-box;
}
</style>
