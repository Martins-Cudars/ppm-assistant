<template>
  <div class="player-growth-comparison-chart">
    <div class="chart-header">
      <h3>Growth Comparison ({{ metricHeading }})</h3>
      <div v-if="!loading && players.length > 0" class="chart-controls">
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
        <div class="age-filter">
          <label>
            Age:
            <input type="number" v-model.number="minAge" min="15" max="45" class="age-input" />
            -
            <input type="number" v-model.number="maxAge" min="15" max="45" class="age-input" />
          </label>
        </div>
        <button @click="hideAllPlayers">Hide All</button>
        <button @click="showAllPlayers">Show All</button>
      </div>
    </div>
    <p v-if="loading" class="loading-state">Loading player history...</p>
    <p v-else-if="players.length === 0" class="loading-state">
      No players to compare - adjust the filters above.
    </p>
    <!-- v-show lives on the wrapper, never on the canvas: Chart.js snapshots
         the canvas's inline style on creation and restores it on destroy(), so a
         canvas hidden via v-show gets permanently re-hidden by every destroy. -->
    <div v-show="!loading && players.length > 0" class="chart-body">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from "vue";
import Chart from "chart.js/auto";
import type { ChartDataset } from "chart.js";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { playerGrowthPrediction } from "@/sports/hockey/settings";
import { getSkillHistoryForPlayer } from "@/storage/skillHistoryDb";
import { SkillHistoryEntry } from "@/types/SkillHistory";
import {
  downsampleHistory,
  getExactAge,
  historyEntryAge,
  readEntryBaseRating,
  readEntryOverallRating,
} from "@/sports/hockey/skillHistoryChart";

const props = defineProps<{
  players: HockeyPlayer[];
  // Sourced from the player store, not getCurrentSeasonDay(): this component
  // renders on the standalone player-report page, which has no game DOM.
  currentSeasonDay: number;
}>();

type Metric = "skill" | "or";

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;
const loading = ref(true);
const minAge = ref(15);
const maxAge = ref(30);
const activeMetric = ref<Metric>("skill");

// History is fetched once per player set and reused across metric switches -
// each lookup is a round trip to the background worker, so re-fetching them
// every time the user flips a tab would be needlessly slow.
let playerHistories = new Map<string, SkillHistoryEntry[]>();

const metricHeading = computed(() => (activeMetric.value === "or" ? "OR" : "Base"));
const axisLabel = computed(() => (activeMetric.value === "or" ? "Overall Rating" : "Skill"));

// Distinct colors for an unbounded number of players - golden-angle hue
// rotation spreads colors evenly regardless of how many players there are.
const colorForIndex = (index: number): string => {
  const hue = (index * 137.508) % 360;
  return `hsl(${hue}, 65%, 45%)`;
};

/**
 * The value a history entry contributes on the active tab, or null when that
 * entry can't speak to it - a profile capture of an unscouted player has an
 * overall rating but no attributes to derive a skill rating from, and older
 * entries may predate overall-rating capture entirely.
 */
const readEntryValue = (entry: SkillHistoryEntry): number | null =>
  activeMetric.value === "or" ? readEntryOverallRating(entry) : readEntryBaseRating(entry);

/** The player's present-day value on the active tab. */
const readPlayerValue = (player: HockeyPlayer): number | null => {
  if (activeMetric.value === "or") {
    return Number.isFinite(player.overallRating) && player.overallRating > 0
      ? player.overallRating
      : null;
  }

  return player.getBestPosition().ratingWithBonus;
};

const buildPlayerDatasets = (): ChartDataset<"line">[] => {
  const datasets: ChartDataset<"line">[] = [];

  props.players.forEach((player, index) => {
    const exactAge = getExactAge(player, props.currentSeasonDay || 1);
    const color = colorForIndex(index);

    const history = playerHistories.get(player.id) ?? [];
    // Filter to entries usable on the active metric *before* thinning, not
    // after: an unscouted player's profile capture carries an overall rating
    // but no skills, so it yields nothing on the Skill tab. Were such an entry
    // the latest in its window, downsampling first would discard that whole
    // window even though earlier entries in it had usable skills.
    const usable = history.filter((entry) => readEntryValue(entry) !== null);
    const data = downsampleHistory(usable)
      .map((entry) => {
        const value = readEntryValue(entry);
        return value === null ? null : { x: historyEntryAge(entry, exactAge), y: value };
      })
      .filter((point): point is { x: number; y: number } => point !== null);

    if (data.length > 0) {
      datasets.push({
        label: player.name,
        data,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        pointRadius: 2,
        showLine: true,
        tension: 0,
      });
      return;
    }

    // No usable history on this metric - fall back to a single dot at the
    // player's current value so they're still on the chart.
    const currentValue = readPlayerValue(player);
    if (currentValue === null) return;

    datasets.push({
      label: player.name,
      data: [{ x: exactAge, y: currentValue }],
      borderColor: color,
      backgroundColor: color,
      pointRadius: 5,
      pointHoverRadius: 7,
      showLine: false,
    });
  });

  return datasets;
};

/**
 * The grey "what a top player looks like at this age" curve. Only meaningful
 * on the skill tab - playerGrowthPrediction models positional skill, and has
 * no overall-rating equivalent.
 */
const buildReferenceDataset = (): ChartDataset<"line">[] => {
  if (activeMetric.value === "or") return [];

  return [
    {
      label: "Top Player Curve (Base)",
      data: playerGrowthPrediction.map((p) => ({ x: p.age, y: p.skill })),
      borderColor: "#ccc",
      backgroundColor: "transparent",
      borderWidth: 2,
      pointRadius: 0,
      showLine: true,
      tension: 0.4,
      order: 10,
    },
  ];
};

/**
 * Index of the first player dataset, i.e. past any reference curve. The OR tab
 * has no reference curve, so player datasets start at 0 there.
 */
const firstPlayerDatasetIndex = (): number => (activeMetric.value === "or" ? 0 : 1);

const renderChart = () => {
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
      console.error("[PlayerGrowthComparisonChart] Failed to destroy previous chart:", error);
    }
    chartInstance = null;
  }

  const label = axisLabel.value;

  try {
    chartInstance = new Chart(chartCanvas.value, {
      type: "line",
      data: {
        datasets: [...buildReferenceDataset(), ...buildPlayerDatasets()],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: label,
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
                const point = context.raw as { x: number; y: number };
                return `${context.dataset.label}: ${point.y} (Age ${point.x.toFixed(1)})`;
              },
            },
          },
        },
      },
    });
  } catch (error) {
    console.error("[PlayerGrowthComparisonChart] Failed to render chart:", error);
    chartInstance = null;
  }
};

const loadAndRender = async () => {
  loading.value = true;

  const histories = await Promise.all(
    props.players.map(
      async (player) => [player.id, await getSkillHistoryForPlayer(player.id)] as const
    )
  );
  playerHistories = new Map(histories);

  loading.value = false;
  // Let Vue flush the v-show update first - Chart.js reads the canvas box at
  // construction time, and a hidden canvas measures zero.
  await nextTick();
  renderChart();
};

const hideAllPlayers = () => {
  if (!chartInstance) return;
  const firstPlayer = firstPlayerDatasetIndex();
  chartInstance.data.datasets.forEach((_, index) => {
    if (index < firstPlayer) return; // keep the grey reference curve visible
    chartInstance!.setDatasetVisibility(index, false);
  });
  chartInstance.update();
};

const showAllPlayers = () => {
  if (!chartInstance) return;
  chartInstance.data.datasets.forEach((_, index) => {
    chartInstance!.setDatasetVisibility(index, true);
  });
  chartInstance.update();
};

onMounted(() => {
  loadAndRender();
});

// currentSeasonDay arrives asynchronously with the cache load, so re-render
// when it lands as well as when the filtered player set changes.
watch([() => props.players, () => props.currentSeasonDay], () => {
  loadAndRender();
});

// Switching tabs re-plots the histories already in memory - no re-fetch.
watch(activeMetric, () => {
  if (!loading.value) {
    renderChart();
  }
});

// An axis-range change needs no new chart - mutating the scale bounds in place
// keeps the user's legend / Hide All visibility selections, and avoids tearing
// down the canvas on every keystroke.
watch([minAge, maxAge], () => {
  if (!chartInstance) return;

  const safeMinAge = Number.isFinite(minAge.value) ? minAge.value : 15;
  const safeMaxAge = Number.isFinite(maxAge.value) ? maxAge.value : 45;
  if (safeMinAge >= safeMaxAge) return;

  chartInstance.options.scales!.x!.min = safeMinAge;
  chartInstance.options.scales!.x!.max = safeMaxAge;
  chartInstance.update();
});
</script>

<style scoped>
.player-growth-comparison-chart {
  height: 500px;
  display: flex;
  flex-direction: column;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 15px;
  box-sizing: border-box;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.player-growth-comparison-chart h3 {
  margin: 0;
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-tabs {
  display: flex;
  gap: 4px;
  margin-right: 8px;
}

.chart-tabs button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.age-filter {
  display: flex;
  align-items: center;
}

.age-input {
  width: 50px;
  margin: 0 5px;
}

.chart-controls button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.chart-controls button:hover {
  background: #f8f9fa;
}

.chart-tabs button.active:hover {
  background: #0069d9;
}

.loading-state {
  color: #666;
  text-align: center;
  padding: 40px;
}

.chart-body {
  flex: 1;
  min-height: 0;
  position: relative;
}
</style>
