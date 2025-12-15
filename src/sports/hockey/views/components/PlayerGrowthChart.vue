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

const calculateData = () => {
  const ageData = [];
  const skillData = [];
  const skillWithExpData = [];
  const projectedPureData = [];
  const projectedTotalData = [];

  const bestPos = props.player.getBestPosition();
  const currentPureSkill = bestPos.ratingWithBonus;

  // We loop from 15 to 45
  for (let age = 15; age <= 45; age++) {
    ageData.push(age);

    const targetGrowthData = playerGrowthPrediction.find((p) => p.age === age);

    if (targetGrowthData) {
        // Base / Pure skill line
        projectedPureData.push(targetGrowthData.skill);

        // Total skill line (Skill + Exp bonus)
        // Formula: skill * (1 + exp / 500)
        // We can check how calculateSkillWithExp is implemented or just replicate it:
        // Math.round(skill * (1 + experience / 500))
        const total = Math.round(targetGrowthData.skill * (1 + targetGrowthData.exp / 500));
        projectedTotalData.push(total);
    } else {
        projectedPureData.push(null);
        projectedTotalData.push(null);
    }

    // Player's current point
    if (age === props.player.age) {
      skillData.push(currentPureSkill);
      skillWithExpData.push(bestPos.ratingWithXp);
    } else {
      skillData.push(null);
      skillWithExpData.push(null);
    }
  }

  return {
    ageData,
    skillData,
    skillWithExpData,
    projectedPureData,
    projectedTotalData,
  };
};

const renderChartWithLogic = () => {
  if (!chartCanvas.value) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  const {
    ageData,
    skillData,
    skillWithExpData,
    projectedPureData,
    projectedTotalData,
  } = calculateData();

  chartInstance = new Chart(chartCanvas.value, {
    type: "line",
    data: {
      labels: ageData,
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
          data: skillWithExpData,
          borderColor: "rgba(255, 99, 132, 1)",
          backgroundColor: "rgba(255, 99, 132, 0.5)",
          pointRadius: 10,
          pointHoverRadius: 12,
          showLine: false,
        },
        {
          label: "Current Skill (Base)",
          data: skillData,
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
