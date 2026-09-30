/*
 * Heatmap shading for the Player Report tables. Magnitude is one hue,
 * light -> dark (never green -> red, which reads as good/bad and fails
 * colour-blind readers). Skills and growth are two separate contexts on
 * screen, so each gets its own hue. Both ramps were checked with the dataviz
 * palette validator: monotone lightness, even steps (every gap >= 0.06 L), a
 * single hue. The lightest step is allowed to fade toward the white surface -
 * it means "near zero", and every value is printed in the cell anyway. Dark
 * ink on the four light steps, white on the two dark ones (>= 4.77:1).
 */
export const SKILL_RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"];
export const GROWTH_RAMP = ["#fde0d0", "#f8bd9e", "#f39a6e", "#eb6834", "#c24e1c", "#983b17"];

/** Below this share of the scale a cell stays unshaded, so near-zero values recede. */
const HEAT_FLOOR = 0.15;

/**
 * The shade for a value between `min` and `max`. Skills use 0..max - an
 * untrained skill really is near zero. Values that cluster (Pace mostly
 * 55-75%, @25 mostly 700-870) use the column's min..max instead; on 0..max
 * nearly every such cell landed in the two darkest steps.
 */
export function heatStyle(
  value: number | null | undefined,
  min: number,
  max: number,
  ramp: string[]
): { background: string; color: string } | undefined {
  if (value == null || !(max > min)) return undefined;
  const share = Math.max(0, Math.min(1, (value - min) / (max - min)));
  if (share < HEAT_FLOOR) return undefined;

  const step = Math.min(
    ramp.length - 1,
    Math.floor(((share - HEAT_FLOOR) / (1 - HEAT_FLOOR)) * ramp.length)
  );
  return { background: ramp[step], color: step >= ramp.length - 2 ? "#fff" : "#1f2328" };
}
