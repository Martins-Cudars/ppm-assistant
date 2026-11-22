<template>
  <div class="player-growth-chart">
    <div class="chart-header">
      <span class="chart-title">{{
        metric === "or" ? "Growth (OR)" : "Growth (best position, no XP unless marked)"
      }}</span>
      <GrowthMetricToggle v-model="metric" class="chart-metric" />
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
 * The basketball profile's growth chart - hockey's PlayerGrowthChart, with
 * basketball's adaptive references:
 *
 * - grey: your squad's best rating on reaching each age (hockey draws a
 *   top-player table here; basketball has none);
 * - red: today's rating, without and with XP;
 * - blue: the stored history, each day rated with that day's height;
 * - dashed blue: the projection at the player's own pace, as the report's
 *   @25 column computes it.
 */
import { onMounted, ref, watch } from "vue";
import Chart from "chart.js/auto";
import type { ChartDataset } from "chart.js";
import { BasketballPlayer, BasketballSkills } from "@/sports/basketball/classes/BasketballPlayer";
import { StoredBasketballPlayer, normalizePlayerId } from "@/sports/basketball/capture";
import { basketballPlayerProfile } from "@/sports/basketball/playerProfile";
import {
  REFERENCE_LAST_AGE,
  buildReferenceCurve,
  measureBasketballPace,
} from "@/sports/basketball/growthModel";
import {
  Point,
  buildSquadBestCurve,
  historyPoints,
  projectionPoints,
} from "@/sports/basketball/historyChart";
import { exportSkillHistory, getSkillHistoryForPlayer } from "@/storage/skillHistoryDb";
import { readSportTeamCache } from "@/storage/playerCache";
import { SkillHistoryEntry } from "@/types/SkillHistory";
import { getCurrentSeasonDay } from "@/utils/dom";
import GrowthMetricToggle from "@/components/GrowthMetricToggle.vue";
import { growthMetricAxisTitle, useGrowthMetric } from "@/components/growthMetric";

const props = defineProps<{ player: BasketballPlayer }>();

type Entry = SkillHistoryEntry<BasketballSkills>;

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

const minAge = ref(Math.max(15, Math.floor(props.player.age) - 3));
const maxAge = ref(Math.min(45, Math.ceil(props.player.age) + 5));

const playerId = normalizePlayerId(props.player.id) ?? props.player.id;
const exactAge = props.player.age + (getCurrentSeasonDay() || 1) / basketballPlayerProfile.daysPerSeason;

// Filled in by load(); the chart draws the current point straight away and
// the rest once the history arrives.
// Own rows kept so the toggle can re-derive the history without re-querying.
// OR-only rows (unscouted players) have no skills, so they show in OR mode only.
const ownEntries = ref<Entry[]>([]);
const metric = useGrowthMetric();
const history = ref<Point[]>([]);
const projection = ref<Point[]>([]);
const pace = ref<{ value: number; provisional: boolean } | null>(null);
const squadBest = ref<{ skill: Point[]; or: Point[] }>({ skill: [], or: [] });

const group = (entries: Entry[]) => {
  const byPlayer = new Map<string, Entry[]>();
  entries.forEach((entry) => {
    const list = byPlayer.get(entry.playerId);
    if (list) list.push(entry);
    else byPlayer.set(entry.playerId, [entry]);
  });
  return byPlayer;
};

const load = async () => {
  const [own, all, cache] = await Promise.all([
    getSkillHistoryForPlayer(playerId, "basketball") as unknown as Promise<Entry[]>,
    exportSkillHistory("basketball") as unknown as Promise<Entry[] | null>,
    readSportTeamCache<StoredBasketballPlayer>("basketball"),
  ]);

  ownEntries.value = own;
  history.value = historyPoints(own, exactAge, metric.value, props.player.height);

  // The references need the squad: every stored day, and each cached player's
  // age and height today.
  const ages = new Map<string, number>();
  const heights = new Map<string, number>();
  if (cache) {
    const seasonDay = cache.currentSeasonDay || 1;
    Object.values(cache.players).forEach((stored) => {
      const id = normalizePlayerId(stored.baseInfo.id) ?? stored.baseInfo.id;
      ages.set(id, stored.baseInfo.age + seasonDay / basketballPlayerProfile.daysPerSeason);
      heights.set(id, stored.baseInfo.height);
    });
  }
  // The viewed player counts too, even from another team.
  ages.set(playerId, exactAge);
  heights.set(playerId, props.player.height);

  const squadHistory = group(all ?? []);
  if (!squadHistory.has(playerId)) squadHistory.set(playerId, own);
  const curve = buildReferenceCurve(squadHistory, ages);
  squadBest.value = buildSquadBestCurve(squadHistory, ages, heights);

  const measured = measureBasketballPace(own, exactAge, curve);
  pace.value =
    measured?.pace != null ? { value: measured.pace, provisional: measured.provisional } : null;
  projection.value = projectionPoints(
    props.player.skills,
    props.player.height,
    exactAge,
    measured,
    curve,
    REFERENCE_LAST_AGE + 1
  );
  render();
};

const buildDatasets = (): ChartDataset<"line">[] => {
  const best = props.player.getBestPosition();
  const datasets: ChartDataset<"line">[] = [];

  const isOr = metric.value === "or";
  const squadLine = isOr ? squadBest.value.or : squadBest.value.skill;
  if (squadLine.length > 0) {
    datasets.push({
      label: `Your squad's best at each age${isOr ? " (OR)" : ""}`,
      data: squadLine,
      borderColor: "#bbb",
      backgroundColor: "#bbb",
      borderWidth: 2,
      borderDash: [4, 4],
      pointRadius: 2,
      tension: 0.3,
    });
  }
  if (isOr) {
    // OR view: no XP variant and no projection - the growth model is skill-based.
    datasets.push({
      label: "Now (OR)",
      data: [{ x: exactAge, y: props.player.overallRating }],
      borderColor: "rgba(255, 99, 132, 1)",
      backgroundColor: "rgba(255, 99, 132, 1)",
      pointRadius: 10,
      pointHoverRadius: 12,
      showLine: false,
    });
  } else {
    datasets.push(
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
    }
    );
  }
  // Omitted rather than drawn empty: a player never seen on the squad
  // overview or training-progress page simply has no history yet.
  if (history.value.length > 0) {
    datasets.push({
      label: isOr ? "History (OR)" : "History",
      data: history.value,
      borderColor: "rgba(54, 162, 235, 1)",
      backgroundColor: "rgba(54, 162, 235, 1)",
      borderWidth: 2,
      pointRadius: 2,
      tension: 0,
    });
  }
  if (!isOr && projection.value.length > 0 && pace.value) {
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
  if (!chartCanvas.value) return;
  const min = Number.isFinite(minAge.value) ? minAge.value : 15;
  const max = Number.isFinite(maxAge.value) ? maxAge.value : 45;
  if (min >= max) return;

  if (chartInstance) {
    try {
      chartInstance.destroy();
    } catch (error) {
      console.error("[BasketballGrowthChart] Failed to destroy previous chart:", error);
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
          y: { beginAtZero: true, title: { display: true, text: growthMetricAxisTitle(metric.value) } },
          x: {
            type: "linear",
            min,
            max,
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
    console.error("[BasketballGrowthChart] Failed to render chart:", error);
    chartInstance = null;
  }
};

onMounted(() => {
  render();
  load().catch((error) => console.error("[BasketballGrowthChart] Failed to load history:", error));
});

// Switching metric swaps the datasets and axis title in place - no new chart.
watch(metric, (next) => {
  history.value = historyPoints(ownEntries.value, exactAge, next, props.player.height);
  if (!chartInstance) return;
  chartInstance.data.datasets = buildDatasets();
  chartInstance.options.scales!.y!.title!.text = growthMetricAxisTitle(next);
  chartInstance.update();
});

// Mutate the axis in place: keeps the user's legend toggles.
watch([minAge, maxAge], () => {
  const min = Number.isFinite(minAge.value) ? minAge.value : 15;
  const max = Number.isFinite(maxAge.value) ? maxAge.value : 45;
  if (!chartInstance || min >= max) return;
  chartInstance.options.scales!.x!.min = min;
  chartInstance.options.scales!.x!.max = max;
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
