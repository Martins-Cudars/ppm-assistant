/**
 * The Skill / OR choice of the profile growth charts, shared by every sport.
 * Remembered for the browser session (sessionStorage), so the choice survives
 * navigating between player profiles but not a new session.
 */
import { ref, type Ref } from "vue";
import type { Chart, ChartDataset } from "chart.js";

export type GrowthMetric = "skill" | "or";

const STORAGE_KEY = "ppm-assistant:growth-metric";

const readStored = (): GrowthMetric => {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "or" ? "or" : "skill";
  } catch {
    return "skill";
  }
};

export function useGrowthMetric(): Ref<GrowthMetric> {
  return ref<GrowthMetric>(readStored());
}

export function rememberGrowthMetric(metric: GrowthMetric): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, metric);
  } catch {
    // Storage blocked: the choice just lasts until the page closes.
  }
}

/** The y-axis title, which is also the word the legend and tooltip use. */
export const growthMetricAxisTitle = (metric: GrowthMetric) =>
  metric === "or" ? "OR" : "Skill";

/**
 * The y-axis options for a metric. OR sits near the top of its range, so it
 * auto-scales with a little padding instead of starting at zero, which would
 * flatten its growth into a line.
 */
export const growthMetricScale = (metric: GrowthMetric) => ({
  beginAtZero: metric !== "or",
  grace: metric === "or" ? "5%" : 0,
  title: { display: true, text: growthMetricAxisTitle(metric) },
});

/** Re-point a live chart's y axis at a metric, in place. */
export function applyGrowthMetricScale(chart: Chart, metric: GrowthMetric): void {
  Object.assign(chart.options.scales!.y!, growthMetricScale(metric));
}

/**
 * The datasets of the OR view, shared by the three profile charts: today's OR
 * (left out when it is missing, 0 or NaN) and the stored OR history. The
 * skill-only lines have no OR equivalent, so each chart adds its own OR
 * reference, if it has one, before these.
 */
export function orDatasets(options: {
  exactAge: number;
  current: number | undefined;
  history: { x: number; y: number }[];
}): ChartDataset<"line">[] {
  const datasets: ChartDataset<"line">[] = [];
  if (typeof options.current === "number" && options.current > 0) {
    datasets.push({
      label: "Now (OR)",
      data: [{ x: options.exactAge, y: options.current }],
      borderColor: "rgba(255, 99, 132, 1)",
      backgroundColor: "rgba(255, 99, 132, 1)",
      pointRadius: 10,
      pointHoverRadius: 12,
      showLine: false,
    });
  }
  if (options.history.length > 0) {
    datasets.push({
      label: "History (OR)",
      data: options.history,
      borderColor: "rgba(54, 162, 235, 1)",
      backgroundColor: "rgba(54, 162, 235, 1)",
      borderWidth: 2,
      pointRadius: 3,
      tension: 0,
    });
  }
  return datasets;
}
