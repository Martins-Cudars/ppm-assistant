/**
 * The Skill / OR choice of the growth charts, shared by every sport.
 * Remembered for the browser session in chrome.storage.session, which the
 * sport subdomains, the extension's report page and every tab share; the
 * background worker opens it to content scripts (setAccessLevel). Where
 * that isn't available (a static harness, or before the worker ran), the
 * page's own sessionStorage keeps it per origin and tab.
 */
import { ref, watch, type Ref } from "vue";
import type { Chart, ChartDataset } from "chart.js";

export type GrowthMetric = "skill" | "or";

export const GROWTH_METRIC_KEY = "ppm-assistant:growth-metric";

const asMetric = (value: unknown): GrowthMetric | null =>
  value === "or" || value === "skill" ? value : null;

const sessionArea = (): chrome.storage.StorageArea | null => {
  try {
    return typeof chrome !== "undefined" && chrome.storage?.session ? chrome.storage.session : null;
  } catch {
    return null;
  }
};

const readLocal = (): GrowthMetric | null => {
  try {
    return asMetric(sessionStorage.getItem(GROWTH_METRIC_KEY));
  } catch {
    return null;
  }
};

/**
 * The remembered metric as a ref: the page's sessionStorage copy at once,
 * then the shared session's once it is read. `fallback` applies when neither
 * holds one; `force` ignores both (an unscouted player has no skills, so his
 * chart opens on OR).
 */
export function useGrowthMetric(options: { fallback?: GrowthMetric; force?: GrowthMetric } = {}): Ref<GrowthMetric> {
  const metric = ref<GrowthMetric>(options.force ?? readLocal() ?? options.fallback ?? "skill");
  const area = sessionArea();
  if (!options.force && area) {
    // Any change while the read is pending is the user's choice, and it
    // stands. Comparing with the initial value instead would miss a switch
    // there and back (Skill, OR, Skill) and overwrite it.
    let userChose = false;
    const stopWatching = watch(metric, () => (userChose = true), { flush: "sync" });
    area
      .get(GROWTH_METRIC_KEY)
      .then((data) => {
        stopWatching();
        const stored = asMetric(data?.[GROWTH_METRIC_KEY]);
        if (stored && !userChose) metric.value = stored;
      })
      .catch(() => {
        stopWatching();
        // Not opened to this context: the sessionStorage copy stands.
      });
  }
  return metric;
}

export function rememberGrowthMetric(metric: GrowthMetric): void {
  try {
    sessionStorage.setItem(GROWTH_METRIC_KEY, metric);
  } catch {
    // Storage blocked: the shared copy below, or just this page.
  }
  sessionArea()
    ?.set({ [GROWTH_METRIC_KEY]: metric })
    .catch(() => {
      // Not opened to this context: the sessionStorage copy stands.
    });
}

/**
 * The growth charts' age range from their Age inputs, or null while it is
 * momentarily invalid (min >= max). v-model.number leaves an input's ref as
 * a raw (empty) string mid-edit, so a bound that isn't a number falls back
 * to 15 or 45 rather than reaching Chart.js.
 */
export function ageRange(minAge: unknown, maxAge: unknown): { min: number; max: number } | null {
  const min = typeof minAge === "number" && Number.isFinite(minAge) ? minAge : 15;
  const max = typeof maxAge === "number" && Number.isFinite(maxAge) ? maxAge : 45;
  return min < max ? { min, max } : null;
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

/**
 * The OR view's grey "Top 5% (OR)" line: the top-5% OR line by age
 * (relativeOrReference), drawn like the Skill view's top-5% lines. All three
 * sports' profile charts.
 */
export function orReferenceDataset(line: readonly { age: number; or: number }[]): ChartDataset<"line"> {
  return {
    label: "Top 5% (OR)",
    data: line.map((row) => ({ x: row.age, y: row.or })),
    borderColor: "#ccc",
    backgroundColor: "#ccc",
    borderWidth: 2,
    pointRadius: 2,
    pointBackgroundColor: "#fff",
    pointBorderColor: "#ccc",
    fill: false,
    tension: 0.4,
    // Monotone, as the Skill view's line: a plain spline overshoots between ages.
    cubicInterpolationMode: "monotone",
  };
}

/**
 * The OR view's dashed projection at the player's own OR pace, styled as the
 * Skill view's; the legend gives the pace, e.g. "Projected at own pace (OR,
 * 64%)", or "~64%, provisional" on a short window. Null without points.
 */
export function orProjectionDataset(
  points: { x: number; y: number }[],
  pace: { value: number; provisional: boolean } | null
): ChartDataset<"line"> | null {
  if (points.length === 0 || !pace) return null;
  const { value, provisional } = pace;
  return {
    label: `Projected at own pace (OR, ${provisional ? "~" : ""}${Math.round(value * 100)}%${provisional ? ", provisional" : ""})`,
    data: points,
    borderColor: "rgba(54, 162, 235, 1)",
    backgroundColor: "rgba(54, 162, 235, 1)",
    borderWidth: 2,
    borderDash: [6, 4],
    pointRadius: 0,
    fill: false,
    tension: 0,
  };
}
