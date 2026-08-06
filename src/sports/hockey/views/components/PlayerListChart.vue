<template>
  <div class="player-list-chart white_box">
    <div class="chart-header">
      <h3>Team {{ activeMetric === "skill" ? "Skill" : "OR" }} Distribution</h3>
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
      </div>
    </div>
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
  players: HockeyPlayer[];
}>();

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

const activeMetric = ref<"skill" | "or">("skill");

const positionColors: Record<string, string> = {
  G: "#4CAF50",
  D: "#2196F3",
  W: "#FF9800",
  C: "#9C27B0",
};

const calculateData = () => {
  const seasonDay = getCurrentSeasonDay() || 1;
  const seasonProgress = seasonDay / 112;

  const playersByPosition: Record<string, { x: number; y: number; name: string }[]> = {
    G: [],
    D: [],
    W: [],
    C: [],
  };

  // Group values by age for average calculation
  const valuesByAge: Record<number, number[]> = {};

  props.players.forEach((player) => {
    const bestPos = player.getBestPosition();
    const exactAge = player.age + seasonProgress;
    const value = activeMetric.value === "skill" ? bestPos.ratingWithXp : player.overallRating;

    playersByPosition[bestPos.name]?.push({
      x: exactAge,
      y: value,
      name: player.name,
    });

    // Collect values by integer age
    if (!valuesByAge[player.age]) {
      valuesByAge[player.age] = [];
    }
    valuesByAge[player.age].push(value);
  });

  // Calculate average value per age
  const averageData = Object.entries(valuesByAge)
    .map(([age, values]) => ({
      x: parseInt(age) + seasonProgress,
      y: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    }))
    .sort((a, b) => a.x - b.x);

  // Growth prediction line (total skill with exp) - skill metric only
  const projectedData =
    activeMetric.value === "skill"
      ? playerGrowthPrediction.map((p) => ({
          x: p.age,
          y: Math.round(p.skill * (1 + p.exp / 500)),
        }))
      : [];

  return { playersByPosition, projectedData, averageData };
};

const renderChart = () => {
  if (!chartCanvas.value) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  const { playersByPosition, projectedData, averageData } = calculateData();
  const metricLabel = activeMetric.value === "skill" ? "Skill" : "OR";

  const datasets = [
    ...(projectedData.length
      ? [
          {
            label: "Top Player Curve",
            data: projectedData,
            borderColor: "#ccc",
            backgroundColor: "transparent",
            borderWidth: 2,
            pointRadius: 0,
            showLine: true,
            tension: 0.4,
            order: 10,
          },
        ]
      : []),
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
      data: data,
      borderColor: positionColors[position],
      backgroundColor: positionColors[position],
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
            text: metricLabel,
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
              return `${metricLabel}: ${point.y}`;
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
