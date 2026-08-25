# Known Issues

Bugs that were investigated but not resolved. Check here before re-investigating
from scratch, and move an entry to **Resolved** once it's actually fixed.

## Open

_None currently._

## Resolved

### Chart.js `destroy()` restores the canvas's inline `display` - never `v-show` a canvas

**Was:** the Growth Comparison chart (`PlayerGrowthComparisonChart.vue`) went
permanently blank - whole canvas, axes and all, with no console errors - as soon
as either age-filter input was changed. Clicking any other filter on the page
brought it back.

**Cause:** `v-show` was applied directly to the `<canvas>`. Chart.js's
`initCanvas()` snapshots the canvas's *inline* style (including `display`) when a
chart is constructed, and `releaseContext()` writes that snapshot back on
`destroy()`. The component's first chart was constructed while `loading` was
still `true` in the DOM - `loadAndRender()` set `loading.value = false` and then
called `renderChart()` synchronously, before Vue's microtask flush - so Chart.js
captured `display: none`. That first render still appeared, because Vue flushed
straight after and the ResizeObserver repainted the chart. But every later
`destroy()` restored the captured `display: none`, and nothing touched `loading`
on the age-filter path, so Vue never re-applied `display: ''`. Clicking another
filter worked only because it changed `props.players`, which toggles `loading`
and makes Vue re-run `v-show`.

**Fix (three parts):**
1. `v-show` moved onto a `.chart-body` wrapper div, so Chart.js only ever
   snapshots the canvas's own (unset) `display`. **This is the general rule:
   never put `v-show` - or anything else that writes inline `display: none` -
   directly on a Chart.js canvas.**
2. The age-range watcher now mutates `chartInstance.options.scales.x.min/max`
   and calls `.update()` instead of destroying and recreating the chart. Cheaper,
   and it preserves the user's legend / "Hide All" visibility selections, which
   the rebuild used to wipe.
3. `loadAndRender()` awaits `nextTick()` after clearing `loading`, so the chart
   is constructed against a laid-out canvas rather than a zero-sized hidden one.

**Ruled out along the way** (all were reasonable-sounding but wrong): non-numeric
axis bounds from `v-model.number`'s mid-edit empty-string state, an exception
being swallowed during destroy/recreate, and `nextTick()` in the age watcher
(nothing in the template depended on `minAge`/`maxAge`, so it resolved
immediately and deferred nothing).
