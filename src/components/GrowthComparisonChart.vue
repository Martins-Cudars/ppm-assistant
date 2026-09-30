<template>
  <div class="growth-comparison-chart">
    <div class="chart-header">
      <h3>Growth Comparison ({{ activeMetric === "or" ? "OR" : "Skill, no XP" }})</h3>
      <div v-if="!loading && series.length > 0" class="chart-controls">
        <div class="chart-tabs">
          <button :class="{ active: activeMetric === 'skill' }" @click="activeMetric = 'skill'">
            Skill
          </button>
          <button :class="{ active: activeMetric === 'or' }" @click="activeMetric = 'or'">OR</button>
        </div>
        <div class="age-filter">
          <label>
            Age:
            <input type="number" v-model.number="minAge" min="15" max="45" class="age-input" />
            -
            <input type="number" v-model.number="maxAge" min="15" max="45" class="age-input" />
          </label>
        </div>
        <button @click="setPlayersVisible(false)">Hide All</button>
        <button @click="setPlayersVisible(true)">Show All</button>
      </div>
    </div>
    <p v-if="loading" class="loading-state">Loading player history...</p>
    <p v-else-if="series.length === 0" class="loading-state">
      No players to compare - adjust the filters above.
    </p>
    <!-- v-show lives on the wrapper, never on the canvas: Chart.js snapshots
         the canvas's inline style on creation and restores it on destroy(). -->
    <div v-show="!loading && series.length > 0" class="chart-body">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Every player's growth on one chart, by age - a sport-agnostic version of
 * hockey's PlayerGrowthComparisonChart. The caller builds the series (points
 * per metric) and an optional grey reference line; this only draws them.
 */
import { nextTick, onMounted, ref, watch } from "vue";
import Chart from "chart.js/auto";
import type { ChartDataset } from "chart.js";

type Point = { x: number; y: number };
export type GrowthSeries = { id: string; label: string; skill: Point[]; or: Point[] };
export type GrowthReference = { label: string; skill: Point[]; or: Point[] };

const props = withDefaults(
  defineProps<{
    series: GrowthSeries[];
    reference?: GrowthReference | null;
    loading?: boolean;
  }>(),
  { reference: null, loading: false }
);

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;
const minAge = ref(15);
const maxAge = ref(30);
const activeMetric = ref<"skill" | "or">("skill");

// Distinct colors for any number of players: golden-angle hue rotation, the
// same scheme as hockey's comparison chart.
const colorForIndex = (index: number) => `hsl(${(index * 137.508) % 360}, 65%, 45%)`;

const referenceCount = () => (props.reference && props.reference[activeMetric.value].length > 0 ? 1 : 0);

const buildDatasets = (): ChartDataset<"line">[] => {
  const datasets: ChartDataset<"line">[] = [];
  const reference = props.reference?.[activeMetric.value] ?? [];
  if (reference.length > 0) {
    datasets.push({
      label: props.reference!.label,
      data: reference,
      borderColor: "#bbb",
      backgroundColor: "transparent",
      borderWidth: 2,
      borderDash: [4, 4],
      pointRadius: 0,
      tension: 0.3,
      order: 10,
    });
  }
  props.series.forEach((series, index) => {
    const data = series[activeMetric.value];
    if (data.length === 0) return;
    const color = colorForIndex(index);
    // A lone point (no history yet) is drawn as a dot so the player still shows.
    datasets.push({
      label: series.label,
      data,
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      pointRadius: data.length === 1 ? 5 : 2,
      showLine: data.length > 1,
      tension: 0,
    });
  });
  return datasets;
};

const safeRange = () => {
  const min = Number.isFinite(minAge.value) ? minAge.value : 15;
  const max = Number.isFinite(maxAge.value) ? maxAge.value : 45;
  return min < max ? { min, max } : null;
};

const renderChart = () => {
  const range = safeRange();
  if (!chartCanvas.value || !range) return;

  if (chartInstance) {
    try {
      chartInstance.destroy();
    } catch (error) {
      console.error("[GrowthComparisonChart] Failed to destroy previous chart:", error);
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
          y: {
            beginAtZero: true,
            title: { display: true, text: activeMetric.value === "or" ? "Overall Rating" : "Skill" },
          },
          x: {
            type: "linear",
            min: range.min,
            max: range.max,
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
    console.error("[GrowthComparisonChart] Failed to render chart:", error);
    chartInstance = null;
  }
};

const setPlayersVisible = (visible: boolean) => {
  if (!chartInstance) return;
  const first = referenceCount();
  chartInstance.data.datasets.forEach((_, index) => {
    if (index >= first) chartInstance!.setDatasetVisibility(index, visible);
  });
  chartInstance.update();
};

// The canvas box is measured at construction, so wait for v-show to flush.
const rerender = async () => {
  await nextTick();
  renderChart();
};

onMounted(rerender);
watch([() => props.series, () => props.reference, () => props.loading, activeMetric], rerender);

// An age-range change needs no new chart: mutating the bounds in place keeps
// the user's legend / Hide All selections.
watch([minAge, maxAge], () => {
  const range = safeRange();
  if (!chartInstance || !range) return;
  chartInstance.options.scales!.x!.min = range.min;
  chartInstance.options.scales!.x!.max = range.max;
  chartInstance.update();
});
</script>

<style scoped>
.growth-comparison-chart {
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
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.growth-comparison-chart h3 {
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

.chart-controls button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.chart-controls button:hover {
  background: #f8f9fa;
}

.chart-tabs button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.age-input {
  width: 50px;
  margin: 0 5px;
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
