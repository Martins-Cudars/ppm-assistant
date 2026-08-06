<template>
  <div class="player-list-chart white_box">
    <div class="chart-header">
      <h3>Team {{ metricLabel }} Distribution</h3>
      <div class="chart-tabs">
        <button
          :class="{ active: activeMetric === 'skill' }"
          @click="activeMetric = 'skill'"
        >
          Skill
        </button>
        <button :class="{ active: activeMetric === 'or' }" @click="activeMetric = 'or'">
          OR
        </button>
        <button :class="{ active: activeMetric === 'exp' }" @click="activeMetric = 'exp'">
          Exp
        </button>
      </div>
    </div>
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import Chart from "chart.js/auto";
import { BasketballPlayer } from "@/sports/basketball/classes/BasketballPlayer";
import { getCurrentSeasonDay } from "@/utils/dom";

const props = defineProps<{
  players: BasketballPlayer[];
}>();

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

const activeMetric = ref<"skill" | "or" | "exp">("skill");

const metricLabels: Record<"skill" | "or" | "exp", string> = {
  skill: "Skill",
  or: "OR",
  exp: "Exp",
};
const metricLabel = computed(() => metricLabels[activeMetric.value]);

const positionColors: Record<string, string> = {
  PG: "#4CAF50",
  SG: "#2196F3",
  SF: "#FF9800",
  PF: "#9C27B0",
  C: "#F44336",
};

const getMetricValue = (player: BasketballPlayer, bestPosRating: number) => {
  switch (activeMetric.value) {
    case "or":
      return player.overallRating;
    case "exp":
      return player.experience;
    default:
      return bestPosRating;
  }
};

const calculateData = () => {
  const seasonDay = getCurrentSeasonDay() || 1;
  const seasonProgress = seasonDay / 112;

  const playersByPosition: Record<
    string,
    { x: number; y: number; name: string }[]
  > = {};
  const valuesByAge: Record<number, number[]> = {};

  props.players.forEach((player) => {
    const bestPos = player.getBestPosition();
    const exactAge = player.age + seasonProgress;
    const value = getMetricValue(player, bestPos.ratingWithXp);

    if (!playersByPosition[bestPos.name]) {
      playersByPosition[bestPos.name] = [];
    }

    playersByPosition[bestPos.name].push({
      x: exactAge,
      y: value,
      name: player.name,
    });

    if (!valuesByAge[player.age]) {
      valuesByAge[player.age] = [];
    }
    valuesByAge[player.age].push(value);
  });

  const averageData = Object.entries(valuesByAge)
    .map(([age, values]) => ({
      x: parseInt(age, 10) + seasonProgress,
      y: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    }))
    .sort((a, b) => a.x - b.x);

  return { playersByPosition, averageData };
};

const renderChart = () => {
  if (!chartCanvas.value) return;

  chartInstance?.destroy();

  const { playersByPosition, averageData } = calculateData();

  const datasets = [
    {
      label: "Team Average",
      data: averageData,
      borderColor: "#E91E63",
      backgroundColor: "transparent",
      borderWidth: 3,
      pointRadius: 4,
      pointBackgroundColor: "#E91E63",
      showLine: true,
      tension: 0.3,
      order: 5,
    },
    ...Object.entries(playersByPosition).map(([position, data]) => ({
      label: position,
      data,
      borderColor: positionColors[position] || "#607D8B",
      backgroundColor: positionColors[position] || "#607D8B",
      pointRadius: 6,
      pointHoverRadius: 8,
      showLine: false,
      order: 1,
    })),
  ];

  chartInstance = new Chart(chartCanvas.value, {
    type: "scatter",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: metricLabel.value,
          },
        },
        x: {
          type: "linear",
          min: 15,
          max: 40,
          title: {
            display: true,
            text: "Age",
          },
          ticks: {
            stepSize: 5,
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: "top",
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const point = context.raw as { x: number; y: number; name?: string };
              if (point.name) {
                return `${point.name}: ${point.y} (Age ${point.x.toFixed(1)})`;
              }
              return `${metricLabel.value}: ${point.y}`;
            },
          },
        },
      },
    },
  });
};

onMounted(() => {
  renderChart();
});

watch(
  () => props.players,
  () => {
    renderChart();
  },
  { deep: true }
);

watch(activeMetric, () => {
  renderChart();
});
</script>

<style scoped>
.player-list-chart {
  margin-top: 20px;
  padding: 15px;
  height: 400px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.player-list-chart h3 {
  margin: 0;
}

.chart-tabs button {
  margin-left: 5px;
  cursor: pointer;
}

.chart-tabs button.active {
  font-weight: bold;
}

canvas {
  max-height: 340px;
}
</style>
