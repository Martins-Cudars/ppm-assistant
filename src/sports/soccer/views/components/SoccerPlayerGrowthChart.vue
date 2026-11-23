<template>
  <div class="player-growth-chart">
    <div class="chart-header">
      <span class="chart-title">{{ metric === "or" ? "Growth (OR)" : "Growth (best position)" }}</span>
      <GrowthMetricToggle v-model="metric" />
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
 * - grey: the top-5% line (relative skill's 100%), base and with XP;
 * - red: today's rating for the best position, base and with XP;
 * - blue: the stored history, each day rated at that day's best position
 *   (no XP - daily history has none);
 * - dashed blue: the projection at the player's own pace, as the report's
 *   @25 column computes it (the shared growth model with soccer's constants).
 *
 * The OR view draws the same without XP: the top-5% OR line, today's OR, the
 * OR history and the projection at the player's OR pace (src/base/orGrowth.ts).
 */
import { computed, onMounted, ref, watch } from "vue";
import Chart from "chart.js/auto";
import type { ChartDataset } from "chart.js";
import { SoccerPlayer, SoccerSkills } from "@/sports/soccer/classes/SoccerPlayer";
import { relativeOrReference, relativeSkillReference } from "@/sports/soccer/relativeSkillReference";
import { soccerPlayerProfile } from "@/sports/soccer/playerProfile";
import {
  measureGrowthPace,
  measureOrPace,
  orProjectionPoints,
  projectionPoints,
} from "@/sports/soccer/growthPace";
import { Point, soccerHistoryPoints } from "@/sports/soccer/historyChart";
import { normalizePlayerId } from "@/base/captureUtils";
import { getSkillHistoryForPlayer } from "@/storage/skillHistoryDb";
import { SkillHistoryEntry } from "@/types/SkillHistory";
import { getCurrentSeasonDay } from "@/utils/dom";
import GrowthMetricToggle from "@/components/GrowthMetricToggle.vue";
import {
  ageRange,
  applyGrowthMetricScale,
  growthMetricScale,
  orDatasets,
  orProjectionDataset,
  orReferenceDataset,
  useGrowthMetric,
} from "@/components/growthMetric";

const props = defineProps<{ player: SoccerPlayer }>();

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

// A window around the player's age rather than 15-45, so a young player's
// progress isn't squeezed into a sliver of the chart.
const minAge = ref(Math.max(15, Math.floor(props.player.age) - 3));
const maxAge = ref(Math.min(45, Math.ceil(props.player.age) + 5));

const exactAge =
  props.player.age + (getCurrentSeasonDay() || 1) / soccerPlayerProfile.daysPerSeason;

// The history rows read once; each metric is derived from them on demand, so
// the toggle never re-queries the store. OR-only rows (unscouted players) have
// no skills, so they appear in OR mode only.
const entries = ref<SkillHistoryEntry<SoccerSkills>[]>([]);
// An unscouted player has no skills: his chart opens on OR.
const metric = useGrowthMetric(props.player.hasKnownSkills() ? {} : { force: "or" });
// Derived, so a new metric or freshly loaded rows can never leave it stale.
const history = computed<Point[]>(() =>
  soccerHistoryPoints(entries.value, exactAge, metric.value)
);
const projection = ref<Point[]>([]);
const pace = ref<{ value: number; provisional: boolean } | null>(null);
// The OR view's projection, at the player's OR pace (src/base/orGrowth.ts).
const orProjection = ref<Point[]>([]);
const orPace = ref<{ value: number; provisional: boolean } | null>(null);

const load = async () => {
  const id = normalizePlayerId(props.player.id) ?? props.player.id;
  entries.value = (await getSkillHistoryForPlayer(id, "soccer")) as unknown as SkillHistoryEntry<SoccerSkills>[];

  const measured = measureGrowthPace(entries.value, exactAge, props.player.getBestPosition().name);
  pace.value =
    measured?.pace != null ? { value: measured.pace, provisional: measured.provisional } : null;
  projection.value = projectionPoints(props.player.skills, exactAge, measured, 45);
  // Measured on skills where the history has them, else on the OR numbers,
  // so an unscouted player gets one too.
  const measuredOr = measureOrPace(entries.value, exactAge);
  orPace.value =
    measuredOr?.pace != null ? { value: measuredOr.pace, provisional: measuredOr.provisional } : null;
  orProjection.value = orProjectionPoints(props.player.overallRating, exactAge, measuredOr, 45);
  render();
};

const range = () => ageRange(minAge.value, maxAge.value);

const buildDatasets = (): ChartDataset<"line">[] => {
  // OR view: the top-5% OR line, today's OR, the OR history and the
  // projection at the player's OR pace. No with-XP line: OR has no XP.
  if (metric.value === "or") {
    const projected = orProjectionDataset(orProjection.value, orPace.value);
    return [
      orReferenceDataset(relativeOrReference),
      ...orDatasets({
        exactAge,
        current: props.player.overallRating,
        history: history.value,
      }),
      ...(projected ? [projected] : []),
    ];
  }

  const best = props.player.getBestPosition();
  const datasets: ChartDataset<"line">[] = [
    {
      label: "Top 5% (with XP)",
      data: relativeSkillReference.map((p) => ({ x: p.age, y: Math.round(p.skill * (1 + p.exp / 500)) })),
      borderColor: "#ccc",
      backgroundColor: "#ccc",
      borderWidth: 2,
      pointRadius: 2,
      pointBackgroundColor: "#fff",
      tension: 0.4,
      // Monotone: a plain spline overshoots between ages and bulges at the
      // axis edge (the top line rose above 33 near 32.8 with 25-33 shown).
      cubicInterpolationMode: "monotone",
    },
    {
      label: "Top 5% (no XP)",
      data: relativeSkillReference.map((p) => ({ x: p.age, y: p.skill })),
      borderColor: "#ccc",
      backgroundColor: "#ccc",
      borderWidth: 2,
      pointRadius: 2,
      pointBackgroundColor: "#fff",
      tension: 0.4,
      // Monotone: a plain spline overshoots between ages and bulges at the
      // axis edge (the top line rose above 33 near 32.8 with 25-33 shown).
      cubicInterpolationMode: "monotone",
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

  return datasets;
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

  try {
    chartInstance = new Chart(chartCanvas.value, {
      type: "line",
      data: { datasets: buildDatasets() },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: growthMetricScale(metric.value),
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

// Switching metric swaps the datasets and axis title in place - no new chart.
watch(metric, (next) => {
  if (!chartInstance) return;
  chartInstance.data.datasets = buildDatasets();
  applyGrowthMetricScale(chartInstance, next);
  chartInstance.update();
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
  margin-right: auto;
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
