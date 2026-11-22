/**
 * The Skill / OR choice of the profile growth charts, shared by every sport.
 * Remembered for the browser session (sessionStorage), so the choice survives
 * navigating between player profiles but not a new session.
 */
import { ref, type Ref } from "vue";

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
