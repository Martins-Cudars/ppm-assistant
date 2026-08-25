<template>
  <div class="player-growth-chart">
    <div class="chart-header">
      <div class="age-filter">
        <label>
          Age:
          <input type="number" v-model.number="minAge" min="15" max="45" class="age-input" />
          -
          <input type="number" v-model.number="maxAge" min="15" max="45" class="age-input" />
        </label>
      </div>
    </div>
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import Chart from "chart.js/auto";
import type { ChartDataset } from "chart.js";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { playerGrowthPrediction } from "@/sports/hockey/settings";
import { getCurrentSeasonDay } from "@/utils/dom";
import { getSkillHistoryForPlayer } from "@/storage/skillHistoryDb";
import { SkillHistoryEntry } from "@/types/SkillHistory";
import { getExactAge, historyEntryToAgePoint } from "@/sports/hockey/skillHistoryChart";

const props = defineProps<{
  player: HockeyPlayer;
}>();

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;
const historyEntries = ref<SkillHistoryEntry[]>([]);

// Default to a window around the player's current age rather than the full
// 15-45 data range, so a young player's progress isn't squeezed into a
// sliver of the chart. Computed once from the initial player prop; the user
// can widen/narrow via the age-filter inputs afterwards.
const minAge = ref(Math.max(15, Math.floor(props.player.age) - 3));
const maxAge = ref(Math.min(45, Math.ceil(props.player.age) + 5));

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
  const exactAge = getExactAge(props.player, seasonDay);

  currentPureData.push({ x: exactAge, y: currentPureSkill });
  currentTotalData.push({ x: exactAge, y: currentTotalSkill });

  // Actual skill history, sourced from prior visits to treninu-progress.html
  // and from profile visits. Entries captured from an unscouted player's
  // profile carry an overall rating but no attributes, so they yield no base
  // rating and drop out here.
  const actualHistoryData = [...historyEntries.value]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => historyEntryToAgePoint(entry, exactAge))
    .filter((point): point is { x: number; y: number } => point !== null);

  return {
    projectedPureData,
    projectedTotalData,
    currentPureData,
    currentTotalData,
    actualHistoryData,
  };
};

const renderChartWithLogic = () => {
  if (!chartCanvas.value) return;

  // v-model.number leaves the ref as a raw (empty) string while the user is
  // mid-edit (e.g. backspacing before typing a new value), since Vue only
  // converts via parseFloat when it succeeds. Fall back to sane defaults
  // rather than feeding Chart.js a non-numeric axis bound, and skip
  // rendering entirely on a momentarily-degenerate range (min >= max) - the
  // next keystroke will produce a valid one.
  const safeMinAge = Number.isFinite(minAge.value) ? minAge.value : 15;
  const safeMaxAge = Number.isFinite(maxAge.value) ? maxAge.value : 45;
  if (safeMinAge >= safeMaxAge) return;

  if (chartInstance) {
    try {
      chartInstance.destroy();
    } catch (error) {
      console.error("[PlayerGrowthChart] Failed to destroy previous chart:", error);
    }
    chartInstance = null;
  }

  const {
    projectedPureData,
    projectedTotalData,
    currentPureData,
    currentTotalData,
    actualHistoryData,
  } = calculateData();

  const datasets: ChartDataset<"line">[] = [
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
  ];

  // Only add the actual-history line once there's data to show - omit it
  // entirely rather than showing an empty/misleading legend entry. History
  // and profile pages are visited independently, so a player never viewed on
  // treninu-progress.html simply won't have this line yet; that's expected.
  if (actualHistoryData.length > 0) {
    datasets.push({
      label: "Actual Skill History (Base)",
      data: actualHistoryData,
      borderColor: "rgba(54, 162, 235, 1)",
      backgroundColor: "rgba(54, 162, 235, 1)",
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: "rgba(54, 162, 235, 1)",
      pointBorderColor: "rgba(54, 162, 235, 1)",
      fill: false,
      tension: 0,
    });
  }

  try {
    chartInstance = new Chart(chartCanvas.value, {
      type: "line",
      data: {
        datasets,
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
            min: safeMinAge,
            max: safeMaxAge,
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
            display: true,
            position: "top",
          },
          tooltip: {
            mode: "index",
            intersect: false,
          },
        },
      },
    });
  } catch (error) {
    console.error("[PlayerGrowthChart] Failed to render chart:", error);
    chartInstance = null;
  }
};

const loadHistory = () => {
  getSkillHistoryForPlayer(props.player.id).then((entries) => {
    historyEntries.value = entries;
    renderChartWithLogic();
  });
};

onMounted(() => {
  renderChartWithLogic();
  loadHistory();
});

watch(
  () => props.player,
  () => {
    renderChartWithLogic();
  },
  { deep: true }
);

watch([minAge, maxAge], () => {
  renderChartWithLogic();
});
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

.chart-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
  margin-bottom: 10px;
}

.age-filter {
  display: flex;
  align-items: center;
}

.age-input {
  width: 50px;
  margin: 0 5px;
}
</style>
