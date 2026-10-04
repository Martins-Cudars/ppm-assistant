/**
 * The data shapes of the shared GrowthComparisonChart.vue, in a plain module
 * so TypeScript code (e.g. src/base/scout/useCompareWith.ts) can use them -
 * `tsc` doesn't read types out of .vue files.
 */

/** `note` is extra tooltip text - e.g. whose value a reference point is. */
export type GrowthPoint = { x: number; y: number; note?: string };
export type GrowthSeries = { id: string; label: string; skill: GrowthPoint[]; or: GrowthPoint[] };
export type GrowthReference = { label: string; skill: GrowthPoint[]; or: GrowthPoint[] };
/** One choice of the reference toggle: button name, the line, and what it is built from. */
export type GrowthReferenceOption = {
  key: string;
  name: string;
  reference: GrowthReference;
  caption?: string;
};
