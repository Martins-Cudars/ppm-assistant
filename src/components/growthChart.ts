/**
 * The chart behind the three per-player growth charts (hockey, soccer,
 * basketball): built from the caller's datasets, with the Skill / OR switch
 * and the age range applied in place, never by rebuilding (see the Chart.js
 * rule in CLAUDE.md).
 *
 * Two things every one of those charts needs, kept here so they stay alike:
 *
 * - A rebuild that comes due while the age inputs are mid-edit (min >= max)
 *   is remembered, and done on the next valid range. Otherwise new history
 *   that arrived meanwhile would never be drawn.
 * - Lines hidden from the legend stay hidden through a rebuild and a metric
 *   switch. Chart.js keeps that state with each dataset object, so it is kept
 *   here too, by each dataset's `key` (KeyedDataset).
 */
import { onBeforeUnmount, watch, type Ref } from "vue";
import Chart from "chart.js/auto";
import type { ChartOptions } from "chart.js";
import {
  ageRange,
  applyGrowthMetricScale,
  growthMetricScale,
  type GrowthMetric,
  type KeyedDataset,
} from "./growthMetric";

type TooltipOptions = NonNullable<NonNullable<ChartOptions<"line">["plugins"]>["tooltip"]>;

export function useProfileGrowthChart(options: {
  /** For log messages, e.g. "PlayerGrowthChart". */
  name: string;
  canvas: Ref<HTMLCanvasElement | null>;
  minAge: Ref<number>;
  maxAge: Ref<number>;
  metric: Ref<GrowthMetric>;
  /** The lines for the current metric, each with a stable key. */
  buildDatasets: () => KeyedDataset[];
  tooltip?: TooltipOptions;
}): { render: () => void } {
  const { name, canvas, minAge, maxAge, metric, buildDatasets } = options;
  let chart: Chart | null = null;
  let rebuildPending = false;
  const hiddenKeys = new Set<string>();

  const withHiddenLines = (datasets: KeyedDataset[]) =>
    datasets.map((dataset) => ({ ...dataset, hidden: hiddenKeys.has(dataset.key) }));

  // Chart.js's own legend toggle, also recorded in hiddenKeys.
  const toggleLine = (target: Chart, index: number | undefined) => {
    if (index === undefined) return;
    const dataset = target.data.datasets[index] as KeyedDataset | undefined;
    if (!dataset) return;
    const key = dataset.key;
    const hide = target.isDatasetVisible(index);
    if (hide) hiddenKeys.add(key);
    else hiddenKeys.delete(key);
    target.setDatasetVisibility(index, !hide);
    target.update();
  };

  const destroy = () => {
    if (!chart) return;
    try {
      chart.destroy();
    } catch (error) {
      console.error(`[${name}] Failed to destroy previous chart:`, error);
    }
    chart = null;
  };

  /** (Re)builds the chart from buildDatasets(): on load, and when the data changes. */
  const render = () => {
    if (!canvas.value) return;
    const range = ageRange(minAge.value, maxAge.value);
    if (!range) {
      rebuildPending = true;
      return;
    }
    rebuildPending = false;
    destroy();

    try {
      chart = new Chart(canvas.value, {
        type: "line",
        data: { datasets: withHiddenLines(buildDatasets()) },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: growthMetricScale(metric.value),
            x: {
              type: "linear",
              min: range.min,
              max: range.max,
              title: { display: true, text: "Age" },
              ticks: { stepSize: 1 },
            },
          },
          plugins: {
            legend: {
              display: true,
              position: "top",
              onClick: (_event, item, legend) => toggleLine(legend.chart, item.datasetIndex),
            },
            tooltip: options.tooltip,
          },
        },
      });
    } catch (error) {
      console.error(`[${name}] Failed to render chart:`, error);
      chart = null;
    }
  };

  // Switching metric swaps the datasets and the y axis in place.
  watch(metric, (next) => {
    if (!chart) return;
    chart.data.datasets = withHiddenLines(buildDatasets());
    applyGrowthMetricScale(chart, next);
    chart.update();
  });

  // The age range moves the axis in place, unless a rebuild is due.
  watch([minAge, maxAge], () => {
    const range = ageRange(minAge.value, maxAge.value);
    if (!range) return;
    if (!chart || rebuildPending) {
      render();
      return;
    }
    chart.options.scales!.x!.min = range.min;
    chart.options.scales!.x!.max = range.max;
    chart.update();
  });

  onBeforeUnmount(destroy);

  return { render };
}
