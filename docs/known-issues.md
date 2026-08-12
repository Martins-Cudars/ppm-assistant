# Known Issues

## Growth Comparison chart blanks permanently when the age filter is changed

**Where:** `src/sports/hockey/views/components/PlayerGrowthComparisonChart.vue` (Player Report → Growth Comparison tab).

**Symptom:** Typing a new value into either of the "Age: [min] - [max]" filter inputs makes the entire chart disappear - not just the data, the whole canvas goes blank (no axes, no gridlines, no reference curve, nothing). It stays blank even once the inputs settle on a fully valid final range (e.g. 15-25). No errors appear in the browser console when this happens.

**Key diagnostic (from the reporter, not yet independently reproduced by an agent - browser automation wasn't connected during any of the sessions that worked on this):** clicking one of the *other* filter buttons on the Player Report page (Position/Freshness/Completeness) makes the chart render correctly again, at whatever age range is currently set. Those filters change `PlayerReport.vue`'s `filteredPlayers`, which flows into this component's `players` prop, which triggers `watch(() => props.players, ...) → loadAndRender()`. The age-range inputs instead trigger a separate `watch([minAge, maxAge], ...)` that calls `renderChart()` more directly. So the same `renderChart()` function works when called from one path and doesn't from the other.

### Things tried that did NOT fix it

1. **Safe-number fallback + try/catch around destroy/create.** Hypothesis: Vue's `v-model.number` leaves the ref holding a raw empty string while the input is mid-edit (e.g. backspacing before typing a new digit), since it only converts via `parseFloat` when that succeeds - feeding a non-number to Chart.js's `scales.x.min`/`max` could break its internals, and an unguarded `chartInstance.destroy()` on a resulting broken instance could then throw on every subsequent call, permanently wedging the chart. Added `Number.isFinite()` fallbacks to 15/45, a `min >= max` guard, and wrapped both `destroy()` and `new Chart(...)` in try/catch. The bug persisted even with valid final numeric values, and no console errors appeared even to trigger the new catch blocks - so this hypothesis, while a reasonable defensive improvement to keep, wasn't the actual cause.
2. **`nextTick()` before the age-range watcher's `renderChart()` call.** Hypothesis: Chart.js reads the canvas's layout size at construction time (`responsive: true`); calling `new Chart(...)` synchronously inside a Vue watcher callback might run before any pending DOM patch, so Chart.js could measure a stale/zero-size box and silently paint nothing (no exception). Added `await nextTick()` before the watcher's `renderChart()` call, mirroring the `await`-driven deferral `loadAndRender()` already gets "for free." Still didn't fix it.
   - **Why this probably didn't help**: `minAge`/`maxAge` don't drive any other template bindings (no `v-if`/`v-show`/interpolation depends on them, only the two input elements' own bound values do). So there's likely nothing actually pending in Vue's DOM patch queue for `nextTick()` to wait through - it probably resolves immediately, providing no real delay. A `requestAnimationFrame`-based wait (which waits for an actual browser layout/paint tick, not just Vue's virtual-DOM patch) would be a meaningfully different thing to try, if the root cause really is canvas-size-at-construction-time related.

### Most promising next step (not yet implemented)

Stop destroying and recreating the whole chart for a pure axis-range change. Mutate the existing `chartInstance`'s scale options in place and call `.update()` instead - the same pattern `hideAllPlayers`/`showAllPlayers` already use successfully for visibility toggles, rather than routing through the full `renderChart()` destroy/recreate path:

```ts
watch([minAge, maxAge], () => {
  if (!chartInstance) return;
  const safeMinAge = Number.isFinite(minAge.value) ? minAge.value : 15;
  const safeMaxAge = Number.isFinite(maxAge.value) ? maxAge.value : 45;
  if (safeMinAge >= safeMaxAge) return;
  chartInstance.options.scales!.x!.min = safeMinAge;
  chartInstance.options.scales!.x!.max = safeMaxAge;
  chartInstance.update();
});
```

This sidesteps the "does Chart.js measure a stale canvas box at construction time" question entirely, since no construction happens for an axis-only change. Whoever picks this up next should verify live in a browser (with `claude-in-chrome` connected, or manually) rather than guessing blind again - none of the three fix attempts above could be reproduced/verified directly by the agent that made them, only reported back second-hand by the user after each attempt.

**Note:** the identical age-filter pattern also exists on the single-player chart (`src/sports/hockey/views/components/PlayerGrowthChart.vue`, player profile page). It received the same safe-number-fallback/try-catch defensive fix (attempt #1 above) but was never reported as exhibiting this exact blanking bug - worth re-testing there too if pursuing this further, since it's a much simpler component (no `players` prop / no alternate "other filter" trigger to compare against).
