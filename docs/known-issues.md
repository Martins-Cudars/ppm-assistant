# Known Issues

Bugs that were investigated but not resolved. Check here before re-investigating
from scratch, and move an entry to **Resolved** once it's actually fixed.

## Open

Found while reviewing the skill-history work. None has been fixed; all were confirmed by
reading the code. Roughly most to least severe.

### The legacy migration marks itself done even when it copied nothing

`migrateLegacySkillHistoryIfNeeded()` sets its `chrome.storage.local` flag unconditionally.
Both calls it makes swallow their own errors and return a benign empty value —
`getAllLegacyEntries()` returns `[]`, `upsertSkillHistoryEntries()` returns `{written: 0}` —
and `written` is never compared against `legacyEntries.length`. One transient failure (the
worker not yet awake, the database blocked) permanently orphans a user's pre-worker history:
the flag says migrated, so it never tries again.

**Fix shape:** only set the flag when `written` matches the number of entries read.

### `getAllLegacyEntries()` creates the junk database it's meant to read

Its `indexedDB.open()` carries an `onupgradeneeded` that creates the object store. For a user
who never had pre-worker data there is nothing to migrate, but the call still **creates** an
empty `ppm-assistant-skill-history` database on `hockey.powerplaymanager.com`. Nothing closes
or deletes the legacy database after a successful migration either, so the data sits
duplicated indefinitely.

`legacySkillHistoryDb.ts` says it is safe to delete once the migration has rolled out to all
users. Nothing tracks when that is.

### `onabort` is unhandled across the worker's IndexedDB operations

A failing request bubbles to the transaction, so `tx.onerror` catches the common case in
`upsertEntries()`. The hole is an **abort with no preceding request error**: nothing settles
the promise, `sendResponse` is never called, and the port stays open until the worker is torn
down. The read paths are worse — `getEntriesForPlayer()`, `getSummaries()` and `getStats()`
wire only `request.onerror`, with no `tx.onerror`/`onabort` at all.

Related: the worker does no validation of inbound entries, so an entry missing `id` throws in
`put()` and aborts the transaction, landing straight in this hole. (Backup import validates
before sending; other callers don't.)

### `openDb()` caches a promise it can never invalidate

`dbPromise` is cleared only on `request.onerror`. There's no `onblocked`, `onversionchange`
or `db.onclose` handler, so a connection the browser force-closes leaves a permanently
poisoned cached promise for the life of the worker.

### `upsertEntries()` reports a count that isn't a write count

It resolves `entries.length` on `tx.oncomplete`, not the number of rows actually changed. So
the gather walk's "N entries" counter and the migration log both count rewrites of unchanged
rows as new work — re-visiting a month "writes" that whole month again.

### `mergeEntry()` overwrites `source` and `capturedAt`

The `...incoming` spread clobbers both unconditionally, so a day whose skills came from
`TrainingProgress` flips to `PlayersList` after one overview visit. The field records the
last writer, not where the stored data came from. Currently cosmetic — nothing reads
`entry.source` for logic (verified) — but it makes the field useless for diagnosis, and the
squad-overview capture now triggers it daily.

### The Player Report claims there's no data while it's still loading

`onMounted` awaits `store.loadFromCache()` with no loading flag and no try/catch. During the
await `filteredPlayers` is empty, so the page renders *"No cached player data found. Visit
player pages to start building your cache."* — a wrong and actionable-sounding instruction
during a completely normal load. `historySummaries` resolves later still, so clicking
`Has history` in that window returns nothing with no indication why.

### All three vite configs write `chunk.js` into the same `dist`

`vite.config.mts`, `vite.player-report.config.mts` and `vite.background.config.mts` all set
`chunkFileNames: "chunk.js"`, with `emptyOutDir: false`, and `pnpm build` runs them in
sequence. **Latent today** — confirmed no `chunk.js` in `dist`, because `background.ts`
imports only types, which are erased. It breaks the Player Report the first time the worker
imports shared runtime code.

### `getCurrentSeasonDay()` still returns 1 silently off game pages

Documented in `utils/dom.ts` rather than fixed. It reads the game's info bar and falls back
to `1` when absent, which is every standalone extension page. One instance of this was a real
bug — history plotted ~0.57 years off on the Player Report chart — and the fix passed the
value down as a prop rather than removing the trap. Returning `null` and forcing callers to
handle it would kill the whole class.

### Two capture paths may disagree about what "today" is

`todayIsoDate()` uses the **user's** local date, and its comment asserts the training-progress
page's dates are "likewise local". Those dates are rendered server-side, presumably in the
game's own timezone. If the user is far enough from it, the same in-game day is written under
two different keys, `mergeEntry()` blends mismatched days, and `missingDays` gains phantom
gaps. Flagged precisely because the comment claims the risk is already handled.

### `historyEntryAge()` assumes calendar days and season days advance 1:1

There's no per-historical-day season value to compute an exact age from, so it extrapolates
backwards at 1:1. Over a multi-season history this drifts if PPM has any inter-season gap.
Worth confirming against the game; if it's wrong, storing the season day at capture time
fixes it exactly.

### `missingDays` overstates gaps for profile-only players

`daysBetween(first, last) + 1 - days`. A player tracked only by occasional profile visits
reports a large gap count although nothing is broken — and that number is surfaced as a
coverage column in the Player Report.

### The worker's stated rationale is wrong in two doc comments

`skillHistoryDb.ts` and `SkillHistoryMessages.ts` both justify routing through the background
worker by saying `player-report.html` "runs under a different origin". It doesn't — it's
opened via `chrome.runtime.getURL()` and shares `chrome-extension://<id>` with the worker, so
it could open the database directly. The real reason is the content scripts, which run on the
game's origin. The architecture is correct; the explanation would mislead the next reader.

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
