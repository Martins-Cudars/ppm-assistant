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

const props = defineProps<{
  player: HockeyPlayer;
}>();

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

const renderChart = () => {
  if (!chartCanvas.value) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  const ageData = [];
  const skillData = [];
  const projectedData = [];

  // Generate data points from age 15 to 40
  for (let age = 15; age <= 40; age++) {
    ageData.push(age);

    // Calculate projected skill for this age based on current skill and age
    const currentGrowthData = playerGrowthPrediction[props.player.age - 15];
    const targetGrowthData = playerGrowthPrediction[age - 15];

    const currentGrowth = currentGrowthData ? currentGrowthData.skill : 1;
    const targetGrowth = targetGrowthData ? targetGrowthData.skill : 1;

    const projectedSkill =
      (targetGrowth / currentGrowth) * props.player.overallRating;
    projectedData.push(projectedSkill);

    if (age === props.player.age) {
      skillData.push(props.player.overallRating);
    } else {
      skillData.push(null);
    }
  }

  chartInstance = new Chart(chartCanvas.value, {
    type: "line",
    data: {
      labels: ageData,
      datasets: [
        {
          label: "Projected Skill",
          data: projectedData,
          borderColor: "rgba(75, 192, 192, 1)",
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
        },
        {
          label: "Current Skill",
          data: skillData,
          borderColor: "rgba(255, 99, 132, 1)",
          backgroundColor: "rgba(255, 99, 132, 1)",
          pointRadius: 8,
          pointHoverRadius: 10,
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
          title: {
            display: true,
            text: "Age",
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
  renderChart();
});

watch(
  () => props.player,
  () => {
    renderChart();
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
}
</style>
