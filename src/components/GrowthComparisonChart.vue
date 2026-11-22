<template>
  <div ref="root" class="growth-comparison-chart" :class="{ 'is-fullscreen': isFullscreen }">
    <div class="chart-header">
      <h3>Growth Comparison ({{ activeMetric === "or" ? "OR" : "Skill, no XP" }})</h3>
      <div v-if="!loading && series.length > 0" class="chart-controls">
        <GrowthMetricToggle v-model="activeMetric" />
        <div class="age-filter">
          <label>
            Age:
            <input type="number" v-model.number="minAge" min="15" max="45" class="age-input" />
            -
            <input type="number" v-model.number="maxAge" min="15" max="45" class="age-input" />
          </label>
        </div>
        <button type="button" @click="setPlayersVisible(false)">Hide All</button>
        <button type="button" @click="setPlayersVisible(true)">Show All</button>
        <button
          v-if="fullscreenSupported"
          type="button"
          class="icon-button"
          :title="isFullscreen ? 'Exit full screen' : 'Full screen'"
          :aria-label="isFullscreen ? 'Exit full screen' : 'Full screen'"
          @click="toggleFullscreen"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
            <path v-if="isFullscreen" d="M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5" />
            <path v-else d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
          </svg>
        </button>
      </div>
    </div>
    <div v-if="!loading && series.length > 0 && referenceOptions.length > 1" class="reference-row">
      <span class="reference-row__label">Reference line:</span>
      <div class="chart-tabs">
        <button
          v-for="option in referenceOptions"
          :key="option.key"
          type="button"
          :class="{ active: activeReference?.key === option.key }"
          :disabled="option.reference[activeMetric].length === 0"
          :title="option.reference[activeMetric].length === 0 ? emptyReferenceTitle(option) : ''"
          @click="selectedReferenceKey = option.key"
        >
          {{ option.name }}
        </button>
      </div>
      <span v-if="referenceCaption" class="reference-row__caption">{{ referenceCaption }}</span>
    </div>
    <p v-if="loading" class="loading-state">Loading player history...</p>
    <p v-else-if="series.length === 0" class="loading-state">
      No players to compare - adjust the filters above.
    </p>
    <!-- v-show lives on the wrapper, never on the canvas: Chart.js snapshots
         the canvas's inline style on creation and restores it on destroy(). -->
    <div v-show="!loading && series.length > 0" class="chart-main">
      <div class="chart-body">
        <canvas ref="chartCanvas"></canvas>
      </div>
      <aside class="chart-legend" aria-label="Chart lines">
        <input
          v-model="search"
          type="search"
          class="legend-search"
          placeholder="Search players"
          aria-label="Search players by name"
        />
        <div class="legend-scroll">
          <ul v-if="referenceLabel" class="legend-list legend-fixed">
            <li>
              <label class="legend-row" :class="{ 'is-hidden': referenceHidden }" :title="referenceLabel">
                <input type="checkbox" :checked="!referenceHidden" @change="referenceHidden = !referenceHidden" />
                <span class="legend-swatch legend-swatch--reference" aria-hidden="true"></span>
                <span class="legend-name">{{ referenceLabel }}</span>
              </label>
            </li>
          </ul>
          <section v-for="group in legendGroups" :key="group.name" class="legend-group">
            <label class="legend-group__header">
              <input
                type="checkbox"
                :checked="group.state === 'all'"
                :indeterminate="group.state === 'some'"
                :aria-label="`Show all ${group.name} players`"
                @change="toggleGroup(group)"
              />
              <span class="legend-group__name">{{ group.name }}</span>
              <span class="legend-group__count" :title="`${group.rows.length} listed`">{{ group.rows.length }}</span>
            </label>
            <ul class="legend-list">
              <li v-for="row in group.rows" :key="row.id">
                <label
                  class="legend-row"
                  :class="{ 'is-hidden': row.hidden, 'is-empty': row.empty }"
                  :title="row.empty ? `${row.label}: no ${activeMetric === 'or' ? 'OR' : 'Skill'} points` : row.label"
                  @mouseenter="hoveredId = row.id"
                  @mouseleave="hoveredId = null"
                  @focusin="onRowFocus(row.id, $event)"
                  @focusout="focusedId = null"
                >
                  <input type="checkbox" :checked="!row.hidden" @change="togglePlayer(row.id)" />
                  <span class="legend-swatch" :style="{ background: row.color }" aria-hidden="true"></span>
                  <span class="legend-name">{{ row.label }}</span>
                  <span v-if="row.age !== undefined" class="legend-age">{{ row.age }}</span>
                </label>
              </li>
            </ul>
          </section>
          <p v-if="legendGroups.length === 0" class="legend-empty">No players match "{{ search }}".</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Every player's growth on one chart, by age, for every sport's Player
 * Report. The caller builds the series (points per metric) and an optional
 * grey reference line; this only draws them.
 *
 * A caller with more than one reference passes `referenceOptions` instead; a
 * toggle then chooses which one is drawn.
 *
 * The legend is our own side list, not Chart.js's: players grouped by
 * position (`groupOrder` orders the groups), a name search, and hover to
 * pick one line out. Which lines are hidden is kept here by series id, so it
 * survives a metric switch, a reference switch and a rebuilt chart.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Chart from "chart.js/auto";
import type { ChartDataset, Color, ScriptableContext } from "chart.js";

import GrowthMetricToggle from "./GrowthMetricToggle.vue";
import { applyGrowthMetricScale, growthMetricScale, useGrowthMetric } from "./growthMetric";
import type {
  GrowthPoint as Point,
  GrowthReference,
  GrowthReferenceOption,
  GrowthSeries,
} from "./growthChartTypes";
export type { GrowthReference, GrowthReferenceOption, GrowthSeries } from "./growthChartTypes";

const props = withDefaults(
  defineProps<{
    series: GrowthSeries[];
    reference?: GrowthReference | null;
    referenceOptions?: GrowthReferenceOption[];
    loading?: boolean;
    /** Side-list group order (positions); others follow alphabetically, then "Other". */
    groupOrder?: readonly string[];
  }>(),
  { reference: null, referenceOptions: () => [], loading: false, groupOrder: () => [] }
);

const root = ref<HTMLElement | null>(null);
const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;
// The series the chart was built from: dataset i + 1 is chartSeries[i]. Until
// a rerender catches up, props.series can already be a different list.
let chartSeries: GrowthSeries[] = [];
const minAge = ref(15);
const maxAge = ref(30);
const activeMetric = useGrowthMetric();

// Distinct colors for any number of players: golden-angle hue rotation, the
// same scheme as hockey's comparison chart.
const colorForIndex = (index: number, alpha = 1) =>
  `hsla(${(index * 137.508) % 360}, 65%, 45%, ${alpha})`;

// The chosen reference option. One with no points on the current metric (the
// scouted lines have no Skill) falls back to the first that has some.
// A model, so a caller with its own toggle (the basketball report's "Compare
// with") stays in step; unbound, it is just local state.
const selectedReferenceKey = defineModel<string | null>("referenceKey", { default: null });
const activeReference = computed<GrowthReferenceOption | null>(() => {
  const usable = props.referenceOptions.filter(
    (option) => option.reference[activeMetric.value].length > 0
  );
  return usable.find((option) => option.key === selectedReferenceKey.value) ?? usable[0] ?? null;
});
const currentReference = computed<GrowthReference | null>(() =>
  props.referenceOptions.length > 0 ? (activeReference.value?.reference ?? null) : props.reference
);
const referenceCaption = computed(() => activeReference.value?.caption ?? "");
// Why a toggle button is disabled: the line exists but not on this metric, or
// there is no data for it yet (its caption says how to get some).
const emptyReferenceTitle = (option: GrowthReferenceOption) => {
  const other = activeMetric.value === "skill" ? "or" : "skill";
  if (option.reference[other].length > 0) {
    return `Only on the ${other === "or" ? "OR" : "Skill"} tab`;
  }
  return option.caption ?? "No data for this line yet";
};

// The reference dataset is always first, even when empty, so switching it
// only swaps its data - see the watcher below.
const REFERENCE_DATASETS = 1;

// --- Visibility and highlight ---------------------------------------------------
// Ours, not Chart.js's: the side list, Hide / Show All and the chart all read
// these, and applyVisibility() pushes them into the chart.

const hiddenIds = ref<ReadonlySet<string>>(new Set());
const referenceHidden = ref(false);
// The row under the mouse wins over the one with keyboard focus.
const hoveredId = ref<string | null>(null);
const focusedId = ref<string | null>(null);
// A hidden line, or one with no points on this metric, has nothing to pick
// out, so the others aren't dimmed for it.
const highlightedId = computed(() => {
  const id = hoveredId.value ?? focusedId.value;
  if (id === null || hiddenIds.value.has(id)) return null;
  const series = props.series.find((candidate) => candidate.id === id);
  return series && series[activeMetric.value].length > 0 ? id : null;
});
// Only keyboard focus highlights: a clicked checkbox keeps the focus, and
// its line would stay picked out after the mouse has left the list.
const onRowFocus = (id: string, event: FocusEvent) => {
  focusedId.value = (event.target as Element).matches(":focus-visible") ? id : null;
};

const setHidden = (ids: string[], hidden: boolean) => {
  const next = new Set(hiddenIds.value);
  ids.forEach((id) => (hidden ? next.add(id) : next.delete(id)));
  hiddenIds.value = next;
};
const togglePlayer = (id: string) => setHidden([id], !hiddenIds.value.has(id));
// Show All forgets every hidden player, also any the filters leave out now,
// so none comes back hidden when the filters change again.
const setPlayersVisible = (visible: boolean) => {
  if (visible) hiddenIds.value = new Set();
  else setHidden(props.series.map((series) => series.id), true);
};

/** Colour, width and stacking of player `index`'s line under the current highlight. */
const playerLineStyle = (index: number, id: string) => {
  const focus = highlightedId.value;
  const color = colorForIndex(index, focus !== null && focus !== id ? 0.15 : 1);
  return {
    borderColor: color,
    backgroundColor: color,
    borderWidth: focus === id ? 4 : 2,
    // Lower order draws on top; the reference sits underneath at 10.
    order: focus === id ? -1 : 0,
  };
};
// The points follow their line's colour through a function: Chart.js shares
// (and, on update("none"), keeps) plain point options between updates, so
// set as values the points would stay bright while their line dims.
const pointColorOfLine = (context: ScriptableContext<"line">) =>
  context.dataset.borderColor as Color;
const referenceLineColor = () =>
  highlightedId.value !== null ? "rgba(187, 187, 187, 0.35)" : "#bbb";

// --- Side list ------------------------------------------------------------------

const OTHER_GROUP = "Other";
const search = ref("");
// Case- and accent-insensitive, so "dan" finds "Dániel".
const normalizeName = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

type LegendRow = {
  id: string;
  label: string;
  age?: number;
  color: string;
  hidden: boolean;
  /** No points on the active metric: listed, but nothing is drawn. */
  empty: boolean;
};
type LegendGroup = { name: string; rows: LegendRow[]; state: "all" | "some" | "none" };

const legendGroups = computed<LegendGroup[]>(() => {
  const query = normalizeName(search.value.trim());
  const groups = new Map<string, LegendRow[]>();
  props.series.forEach((series, index) => {
    if (query && !normalizeName(series.label).includes(query)) return;
    const name = series.group && series.group !== "?" ? series.group : OTHER_GROUP;
    const rows = groups.get(name) ?? [];
    rows.push({
      id: series.id,
      label: series.label,
      age: series.age,
      color: colorForIndex(index),
      hidden: hiddenIds.value.has(series.id),
      empty: series[activeMetric.value].length === 0,
    });
    groups.set(name, rows);
  });
  const rank = (name: string) => {
    if (name === OTHER_GROUP) return Number.POSITIVE_INFINITY;
    const position = props.groupOrder.indexOf(name);
    return position >= 0 ? position : props.groupOrder.length;
  };
  return [...groups]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([name, rows]): LegendGroup => {
      rows.sort((a, b) => a.label.localeCompare(b.label));
      const shown = rows.filter((row) => !row.hidden).length;
      const state = shown === rows.length ? "all" : shown === 0 ? "none" : "some";
      return { name, rows, state };
    });
});

// A group's checkbox acts on the rows it lists (the search applies): when
// all are shown it hides them, otherwise it shows them all.
const toggleGroup = (group: LegendGroup) =>
  setHidden(
    group.rows.map((row) => row.id),
    group.state === "all"
  );

// The reference gets a row in the fixed section at the top only when it has
// points on this metric.
const referenceLabel = computed(() =>
  (currentReference.value?.[activeMetric.value].length ?? 0) > 0
    ? currentReference.value?.label || "Reference"
    : ""
);

// --- Chart ----------------------------------------------------------------------

/**
 * A series' data and point style on the active metric. Every series keeps a
 * dataset, empty on a metric it has no points for, so a metric switch only
 * swaps data and dataset i + 1 stays series i.
 */
const seriesStyle = (series: GrowthSeries) => {
  const data = series[activeMetric.value];
  // A lone point (no history yet) is drawn as a dot so the player still shows.
  return { data, pointRadius: data.length === 1 ? 5 : 2, showLine: data.length > 1 };
};

const buildDatasets = (): ChartDataset<"line">[] => {
  const datasets: ChartDataset<"line">[] = [];
  datasets.push({
    label: currentReference.value?.label ?? "",
    data: currentReference.value?.[activeMetric.value] ?? [],
    borderColor: referenceLineColor(),
    backgroundColor: "transparent",
    borderWidth: 2,
    borderDash: [4, 4],
    pointRadius: 0,
    // No visible points, but hovering the line still finds them - a scouted
    // reference names the player behind each one.
    pointHitRadius: 8,
    tension: 0.3,
    order: 10,
    hidden: referenceHidden.value,
  });
  props.series.forEach((series, index) => {
    datasets.push({
      label: series.label,
      tension: 0,
      pointBackgroundColor: pointColorOfLine,
      pointBorderColor: pointColorOfLine,
      hidden: hiddenIds.value.has(series.id),
      ...playerLineStyle(index, series.id),
      ...seriesStyle(series),
    });
  });
  return datasets;
};

const safeRange = () => {
  const min = Number.isFinite(minAge.value) ? minAge.value : 15;
  const max = Number.isFinite(maxAge.value) ? maxAge.value : 45;
  return min < max ? { min, max } : null;
};

const destroyChart = () => {
  if (!chartInstance) return;
  try {
    chartInstance.destroy();
  } catch (error) {
    console.error("[GrowthComparisonChart] Failed to destroy previous chart:", error);
  }
  chartInstance = null;
  chartSeries = [];
};

const renderChart = () => {
  const range = safeRange();
  if (!chartCanvas.value || !range) return;

  destroyChart();

  try {
    chartSeries = props.series;
    chartInstance = new Chart(chartCanvas.value, {
      type: "line",
      data: { datasets: buildDatasets() },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          // OR doesn't start from zero, or its growth would flatten into a line.
          y: growthMetricScale(activeMetric.value),
          x: {
            type: "linear",
            min: range.min,
            max: range.max,
            title: { display: true, text: "Age" },
            ticks: { stepSize: 1 },
          },
        },
        plugins: {
          // The side list is the legend.
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => {
                const point = context.raw as Point;
                const note = point.note ? ` - ${point.note}` : "";
                return `${context.dataset.label}: ${point.y} (Age ${point.x.toFixed(1)})${note}`;
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

const applyVisibility = () => {
  if (!chartInstance) return;
  chartInstance.setDatasetVisibility(0, !referenceHidden.value);
  chartSeries.forEach((series, index) => {
    chartInstance!.setDatasetVisibility(index + REFERENCE_DATASETS, !hiddenIds.value.has(series.id));
  });
  chartInstance.update();
};
watch([hiddenIds, referenceHidden], applyVisibility);

// Restyles the lines in place, without animation: moving down the list would
// otherwise replay a transition for every row passed.
const applyHighlight = () => {
  if (!chartInstance) return;
  const [reference, ...players] = chartInstance.data.datasets as ChartDataset<"line">[];
  reference.borderColor = referenceLineColor();
  chartSeries.forEach((series, index) => {
    if (players[index]) Object.assign(players[index], playerLineStyle(index, series.id));
  });
  chartInstance.update("none");
};
watch(highlightedId, applyHighlight);

// The canvas box is measured at construction, so wait for v-show to flush.
const rerender = async () => {
  await nextTick();
  renderChart();
};

watch([() => props.series, () => props.loading], rerender);

// A metric switch needs no new chart (the CLAUDE.md Chart.js rule): each
// dataset object keeps its identity and only its data, the reference's data
// and the y axis change.
watch(activeMetric, (metric) => {
  if (!chartInstance) return;
  const [reference, ...players] = chartInstance.data.datasets as ChartDataset<"line">[];
  reference.data = currentReference.value?.[metric] ?? [];
  reference.label = currentReference.value?.label ?? "";
  chartSeries.forEach((series, index) => {
    if (players[index]) Object.assign(players[index], seriesStyle(series));
  });
  applyGrowthMetricScale(chartInstance, metric);
  chartInstance.update();
});

// A different reference line needs no new chart: swapping the first dataset's
// data in place leaves the rest as it is.
watch(currentReference, (reference) => {
  const dataset = chartInstance?.data.datasets[0];
  if (!chartInstance || !dataset) return;
  dataset.label = reference?.label ?? "";
  dataset.data = reference?.[activeMetric.value] ?? [];
  chartInstance.update();
});

// An age-range change needs no new chart: the bounds change in place.
watch([minAge, maxAge], () => {
  const range = safeRange();
  if (!chartInstance || !range) return;
  chartInstance.options.scales!.x!.min = range.min;
  chartInstance.options.scales!.x!.max = range.max;
  chartInstance.update();
});

// --- Full screen ----------------------------------------------------------------
// The whole card (toolbar, chart and side list) goes full screen. Esc or the
// button leaves it; fullscreenchange keeps the icon in step either way.

const fullscreenSupported = typeof document !== "undefined" && document.fullscreenEnabled;
const isFullscreen = ref(false);

const toggleFullscreen = async () => {
  try {
    if (document.fullscreenElement === root.value) await document.exitFullscreen();
    else await root.value?.requestFullscreen();
  } catch (error) {
    console.error("[GrowthComparisonChart] Full screen failed:", error);
  }
};

const onFullscreenChange = async () => {
  isFullscreen.value = root.value !== null && document.fullscreenElement === root.value;
  // Chart.js follows its container through a ResizeObserver; resizing here
  // as well sizes the first frame in (and out of) full screen correctly.
  await nextTick();
  chartInstance?.resize();
};

onMounted(() => {
  document.addEventListener("fullscreenchange", onFullscreenChange);
  rerender();
});

onBeforeUnmount(() => {
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  destroyChart();
});
</script>

<style scoped>
.growth-comparison-chart {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 15px;
  box-sizing: border-box;
  color: #333;
  /* The side list moves under the chart when the card is narrow. */
  container-type: inline-size;
}

/* Full screen: the card fills the screen, white rather than the browser's
   black backdrop, and the chart and list take the height left by the toolbar. */
.growth-comparison-chart.is-fullscreen {
  width: 100vw;
  height: 100vh;
  margin: 0;
  border: 0;
  border-radius: 0;
  padding: 16px 20px;
  background: #fff;
  overflow: hidden;
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
  flex-wrap: wrap;
  gap: 8px;
}

.chart-tabs {
  display: flex;
  gap: 4px;
  margin-right: 8px;
}

/* PPM's page CSS styles bare <button>s and inputs (white text, orange hover
   gradient), so every state below sets its colours itself - as in
   GrowthMetricToggle.vue. */
.chart-controls button,
.reference-row button {
  padding: 6px 12px;
  border: 1px solid #ccc;
  background: #fff;
  background-image: none;
  color: #333;
  text-shadow: none;
  box-shadow: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: normal;
  line-height: 1.4;
}

.reference-row button {
  padding: 4px 10px;
}

.chart-controls button:hover,
.chart-controls button:focus,
.reference-row button:hover,
.reference-row button:focus {
  background: #f0f4fa;
  background-image: none;
  color: #333;
  border-color: #007bff;
}

.chart-controls button:focus-visible,
.reference-row button:focus-visible,
.age-input:focus-visible,
.legend-search:focus-visible {
  outline: 2px solid #007bff;
  outline-offset: 1px;
}

.reference-row button:disabled,
.reference-row button:disabled:hover {
  background: #fff;
  color: #aaa;
  border-color: #ddd;
  cursor: not-allowed;
}

.reference-row .chart-tabs button.active,
.reference-row .chart-tabs button.active:hover,
.reference-row .chart-tabs button.active:focus {
  background: #007bff;
  background-image: none;
  color: #fff;
  border-color: #007bff;
}

.chart-controls .icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 7px;
}

.icon-button svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.reference-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
}

.reference-row__label {
  color: #333;
}

.reference-row__caption {
  color: #666;
}

.age-filter {
  font-size: 13px;
  color: #333;
}

.age-input {
  width: 50px;
  margin: 0 5px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  color: #333;
  padding: 3px 4px;
}

.loading-state {
  color: #666;
  text-align: center;
  padding: 40px;
}

.chart-main {
  display: flex;
  gap: 12px;
  height: 440px;
}

.is-fullscreen .chart-main {
  flex: 1;
  height: auto;
  min-height: 0;
}

.chart-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
}

/* --- Side list --- */

.chart-legend {
  width: 220px;
  flex: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid #e3e3e3;
  border-radius: 4px;
  background: #fff;
  font-size: 12px;
}

.legend-search {
  margin: 8px;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  color: #333;
  font-size: 12px;
}

.legend-search::placeholder {
  color: #888;
}

.legend-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 4px;
}

.legend-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.legend-fixed {
  padding-bottom: 4px;
  margin-bottom: 4px;
  border-bottom: 1px solid #eee;
}

.legend-group__header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: #f4f6f9;
  color: #333;
  font-weight: 600;
  cursor: pointer;
}

/* A pill, so the count doesn't read as one more age in the column below. */
.legend-group__count {
  margin-left: auto;
  padding: 0 6px;
  border-radius: 8px;
  background: #e2e6ec;
  color: #555;
  font-size: 11px;
  font-weight: normal;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  color: #333;
  cursor: pointer;
}

.legend-row:hover {
  background: #f0f4fa;
}

/* The checkbox holds the focus; the whole row shows it. */
.legend-row:has(input:focus-visible),
.legend-group__header:has(input:focus-visible) {
  outline: 2px solid #007bff;
  outline-offset: -2px;
  background: #f0f4fa;
}

.chart-legend input[type="checkbox"] {
  margin: 0;
  flex: none;
  accent-color: #007bff;
  cursor: pointer;
}

.chart-legend input[type="checkbox"]:focus-visible {
  outline: none;
}

.legend-swatch {
  flex: none;
  width: 14px;
  height: 4px;
  border-radius: 2px;
}

.legend-swatch--reference {
  height: 0;
  border-top: 2px dashed #999;
  border-radius: 0;
}

.legend-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-age {
  flex: none;
  color: #777;
}

.legend-row.is-hidden .legend-name,
.legend-row.is-hidden .legend-age {
  color: #aaa;
}

.legend-row.is-hidden .legend-swatch {
  opacity: 0.3;
}

.legend-row.is-empty .legend-name {
  color: #999;
  font-style: italic;
}

.legend-empty {
  margin: 8px;
  color: #777;
}

@container (max-width: 640px) {
  .chart-main {
    flex-direction: column;
    height: auto;
  }

  .chart-body {
    flex: none;
    height: 320px;
  }

  .chart-legend {
    width: auto;
    max-height: 260px;
  }
}
</style>
