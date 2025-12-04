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
  const currentGrowthData = playerGrowthPrediction[props.player.age - 15];
  const currentGrowth = currentGrowthData ? currentGrowthData.skill : 1;
  const currentExpGrowth = currentGrowthData ? currentGrowthData.exp : 1;

  for (let age = 15; age <= 40; age++) {
    ageData.push(age);

    const targetGrowthData = playerGrowthPrediction[age - 15];
    const targetGrowth = targetGrowthData ? targetGrowthData.skill : 1;
    const targetExpGrowth = targetGrowthData ? targetGrowthData.exp : 0;

    const projectedPureSkill =
      (targetGrowth / currentGrowth) * currentPureSkill;
    projectedPureData.push(projectedPureSkill);

    // Project Exp
    let projectedExp = 0;
    if (props.player.experience > 0 && currentExpGrowth > 0) {
      projectedExp =
        (targetExpGrowth / currentExpGrowth) * props.player.experience;
    } else {
      projectedExp = 0;
      if (targetExpGrowth > 0) {
        // Fallback if no current exp, assume 0 for projection or use raw growth curve if we wanted to be generous,
        // but 0 is safer/more accurate for a player with 0 exp.
        projectedExp = 0;
      }
    }

    const projectedExpBonus = Math.floor(
      projectedPureSkill * (projectedExp / 500)
    );
    projectedTotalData.push(projectedPureSkill + projectedExpBonus);

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
          label: "Projected Skill (Total)",
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
          label: "Projected Skill (Base)",
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
