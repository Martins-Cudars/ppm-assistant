<template>
  <div class="player-growth-chart">
    <div class="chart-header">
      <span class="chart-title">Growth (best position)</span>
      <div class="age-filter">
        <label>
          Age:
          <input type="number" v-model.number="minAge" min="15" max="45" class="age-input" />
          -
          <input type="number" v-model.number="maxAge" min="15" max="45" class="age-input" />
        </label>
      </div>
    </div>
    <div class="chart-body">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The soccer profile's growth chart, on hockey's PlayerGrowthChart pattern:
 *
 * - grey: the top-player table, base and with XP;
 * - red: today's rating for the best position, base and with XP;
 * - blue: the stored history, each day rated at that day's best position
 *   (no XP - daily history has none);
 * - dashed blue: the projection at the player's own pace, as the report's
 *   @25 column computes it (the shared growth model with soccer's constants).
 */
import { onMounted, ref, watch } from "vue";
import Chart from "chart.js/auto";
import type { ChartDataset } from "chart.js";
import { SoccerPlayer, SoccerSkills } from "@/sports/soccer/classes/SoccerPlayer";
import { playerGrowthPrediction } from "@/sports/soccer/settings";
import { soccerPlayerProfile } from "@/sports/soccer/playerProfile";
import { measureGrowthPace, projectionPoints } from "@/sports/soccer/growthPace";
import { Point, soccerHistoryPoints } from "@/sports/soccer/historyChart";
import { normalizePlayerId } from "@/base/captureUtils";
import { getSkillHistoryForPlayer } from "@/storage/skillHistoryDb";
import { SkillHistoryEntry } from "@/types/SkillHistory";
import { getCurrentSeasonDay } from "@/utils/dom";

const props = defineProps<{ player: SoccerPlayer }>();

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

// A window around the player's age rather than 15-45, so a young player's
// progress isn't squeezed into a sliver of the chart.
const minAge = ref(Math.max(15, Math.floor(props.player.age) - 3));
const maxAge = ref(Math.min(45, Math.ceil(props.player.age) + 5));

const exactAge =
  props.player.age + (getCurrentSeasonDay() || 1) / soccerPlayerProfile.daysPerSeason;

const history = ref<Point[]>([]);
const projection = ref<Point[]>([]);
const pace = ref<{ value: number; provisional: boolean } | null>(null);

const load = async () => {
  const id = normalizePlayerId(props.player.id) ?? props.player.id;
  const entries = (await getSkillHistoryForPlayer(id, "soccer")) as unknown as SkillHistoryEntry<SoccerSkills>[];
  history.value = soccerHistoryPoints(entries, exactAge, "skill");

  const measured = measureGrowthPace(entries, exactAge, props.player.getBestPosition().name);
  pace.value =
    measured?.pace != null ? { value: measured.pace, provisional: measured.provisional } : null;
  projection.value = projectionPoints(props.player.skills, exactAge, measured, 45);
  render();
};

const range = () => {
  const min = Number.isFinite(minAge.value) ? minAge.value : 15;
  const max = Number.isFinite(maxAge.value) ? maxAge.value : 45;
  return min < max ? { min, max } : null;
};

const render = () => {
  const bounds = range();
  if (!chartCanvas.value || !bounds) return;

  if (chartInstance) {
    try {
      chartInstance.destroy();
    } catch (error) {
      console.error("[SoccerPlayerGrowthChart] Failed to destroy previous chart:", error);
    }
    chartInstance = null;
  }

  const best = props.player.getBestPosition();
  const datasets: ChartDataset<"line">[] = [
    {
      label: "Top player (with XP)",
      data: playerGrowthPrediction.map((p) => ({ x: p.age, y: Math.round(p.skill * (1 + p.exp / 500)) })),
      borderColor: "#ccc",
      backgroundColor: "#ccc",
      borderWidth: 2,
      pointRadius: 2,
      pointBackgroundColor: "#fff",
      tension: 0.4,
    },
    {
      label: "Top player (no XP)",
      data: playerGrowthPrediction.map((p) => ({ x: p.age, y: p.skill })),
      borderColor: "#ccc",
      backgroundColor: "#ccc",
      borderWidth: 2,
      pointRadius: 2,
      pointBackgroundColor: "#fff",
      tension: 0.4,
    },
    {
      label: `Now with XP (${best.name})`,
      data: [{ x: exactAge, y: best.ratingWithXp }],
      borderColor: "rgba(255, 99, 132, 1)",
      backgroundColor: "rgba(255, 99, 132, 0.5)",
      pointRadius: 10,
      pointHoverRadius: 12,
      showLine: false,
    },
    {
      label: `Now (${best.name})`,
      data: [{ x: exactAge, y: best.ratingWithBonus }],
      borderColor: "rgba(255, 99, 132, 1)",
      backgroundColor: "rgba(255, 99, 132, 1)",
      pointRadius: 10,
      pointHoverRadius: 12,
      showLine: false,
    },
  ];

  // Omitted rather than drawn empty: a player never captured has no history yet.
  if (history.value.length > 0) {
    datasets.push({
      label: "History (no XP)",
      data: history.value,
      borderColor: "rgba(54, 162, 235, 1)",
      backgroundColor: "rgba(54, 162, 235, 1)",
      borderWidth: 2,
      pointRadius: 2,
      tension: 0,
    });
  }
  if (projection.value.length > 0 && pace.value) {
    const { value, provisional } = pace.value;
    datasets.push({
      label: `Projected at own pace (${provisional ? "~" : ""}${Math.round(value * 100)}%${provisional ? ", provisional" : ""})`,
      data: projection.value,
      borderColor: "rgba(54, 162, 235, 1)",
      backgroundColor: "rgba(54, 162, 235, 1)",
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 0,
      tension: 0,
    });
  }

  try {
    chartInstance = new Chart(chartCanvas.value, {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Skill" } },
          x: {
            type: "linear",
            min: bounds.min,
            max: bounds.max,
            title: { display: true, text: "Age" },
            ticks: { stepSize: 1 },
          },
        },
        plugins: {
          legend: { display: true, position: "top" },
          tooltip: {
            callbacks: {
              label: (context) => {
                const point = context.raw as Point;
                return `${context.dataset.label}: ${point.y} (Age ${point.x.toFixed(1)})`;
              },
            },
          },
        },
      },
    });
  } catch (error) {
    console.error("[SoccerPlayerGrowthChart] Failed to render chart:", error);
    chartInstance = null;
  }
};

onMounted(() => {
  render();
  load().catch((error) => console.error("[SoccerPlayerGrowthChart] Failed to load history:", error));
});

// Mutate the axis in place: keeps the user's legend toggles.
watch([minAge, maxAge], () => {
  const bounds = range();
  if (!chartInstance || !bounds) return;
  chartInstance.options.scales!.x!.min = bounds.min;
  chartInstance.options.scales!.x!.max = bounds.max;
  chartInstance.update();
});
</script>

<style scoped>
.player-growth-chart {
  width: 100%;
  height: 420px;
  display: flex;
  flex-direction: column;
  background: #fff;
  padding: 16px 20px;
  margin-top: 20px;
  border: 1px solid #c9c9c9;
  border-radius: 5px;
  box-sizing: border-box;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
  margin-bottom: 8px;
}

.chart-title {
  font-weight: 600;
}

.age-input {
  width: 50px;
  margin: 0 5px;
}

.chart-body {
  flex: 1;
  min-height: 0;
  position: relative;
}
</style>
