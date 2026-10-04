/**
 * A per-age rate made non-increasing from its peak on (pool-adjacent-violators
 * over the measured ages: a rise is averaged with the ages before it). Ages
 * before the peak are left as measured. Used by
 * basketball's reference curve and the scouted-rate curves
 * (src/base/scout/scoutReference.ts).
 */
export function smoothFromPeak(measured: Map<number, number>): Map<number, number> {
  const ages = [...measured.keys()].sort((a, b) => a - b);
  const smoothed = new Map(measured);
  if (ages.length === 0) return smoothed;

  const peakAge = ages.reduce((peak, age) => (measured.get(age)! > measured.get(peak)! ? age : peak));
  const blocks: { ages: number[]; value: number }[] = [];
  ages
    .filter((age) => age >= peakAge)
    .forEach((age) => {
      blocks.push({ ages: [age], value: measured.get(age)! });
      while (blocks.length > 1 && blocks[blocks.length - 1].value > blocks[blocks.length - 2].value) {
        const last = blocks.pop()!;
        const previous = blocks.pop()!;
        const merged = [...previous.ages, ...last.ages];
        blocks.push({
          ages: merged,
          value:
            (previous.value * previous.ages.length + last.value * last.ages.length) / merged.length,
        });
      }
    });
  blocks.forEach((block) => block.ages.forEach((age) => smoothed.set(age, block.value)));
  return smoothed;
}
