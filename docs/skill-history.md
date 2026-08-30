# Skill history

Everywhere else the extension keeps only the latest snapshot of a player. This is the one
store that remembers what a player looked like on a given day, so growth can be charted
against the projection instead of guessed at.

Hockey only. Nothing here is wired into soccer or basketball.

## How data gets in

Three capture paths, each seeing something the others can't:

| Path | Covers | Reach |
|---|---|---|
| `viewTrainingProgress.ts` | every day of the month on screen, OR + all 7 skills | own team only — the page doesn't exist for anyone else's players |
| `viewPlayerProfile.ts` → `captureTodaysHistoryEntry()` | one day | **any** player, including other teams'; unscouted opponents yield an OR and no skills |
| `viewPlayerList.ts` → `captureTodaysHistoryEntries()` | one day, whole squad at once | own team; one page visit snapshots everyone |

On top of the training-progress page sits the **Gather history** walk: it follows the game's
own "previous month" link backwards to the player's earliest month, capturing each on the
way. Real navigation, 700 ms between steps, capped at 240 months, with walk state in per-tab
`sessionStorage` so two tabs can't collide.

Because the overview path exists, history now accumulates on its own during normal play. The
gather walk is only needed for *back*fill.

## Where it lives

IndexedDB `ppm-assistant-skill-history`, store `skillHistory`, `keyPath: "id"` where id is
`` `${playerId}:${date}` ``, plus a `by_playerId` index.

The database is owned by the **background service worker** (`src/background.ts`); nothing
else opens it. Everything goes through `chrome.runtime` messages, wrapped by
`src/storage/skillHistoryDb.ts`.

> **Note:** the doc comments at the top of `skillHistoryDb.ts` and `SkillHistoryMessages.ts`
> justify this by saying `player-report.html` runs under a different origin from the worker.
> That is wrong — it's opened via `chrome.runtime.getURL()`, so it shares
> `chrome-extension://<id>` and could open the database directly. The real reason is the
> **content scripts**: they run on the game's origin, and a store they opened themselves
> would be invisible to every extension page. The architecture is right; the stated reason
> isn't. Tracked in [known-issues.md](known-issues.md).

Two design points worth knowing before changing anything:

- **Upserts merge, they don't overwrite.** Two paths can write the same `playerId:date` with
  different fields — the training page has skills, an unscouted opponent's profile has only
  an OR. `mergeEntry()` keeps incoming values where present and existing ones where the
  incoming entry is silent. A blind `put()` would let whichever ran last erase the other.
- **Summaries are derived from keys alone.** Since the id encodes player and date,
  `getSummaries()` uses `getAllKeys()` and never deserialises a record, so annotating a whole
  squad stays cheap at tens of thousands of rows.

Every value field on `SkillHistoryEntry` is optional. Consumers must filter for the field
they need — use the readers in `src/sports/hockey/skillHistoryChart.ts`, which also handle
the deprecated `kr` field (the old name for `overallRating`).

## Backup format

Both stores in one JSON file (`src/types/Backup.ts`, `src/storage/backup.ts`):

```jsonc
{
  "format": "ppm-assistant-backup",  // absent -> rejected outright
  "version": 1,                      // unknown -> rejected outright
  "exportedAt": "2026-08-30T…",
  "extensionVersion": "3.2.0",
  "playerCaches": { "ppm-assistant:hockey:team-12345": { /* PlayerCacheStorage */ } },
  "skillHistory": [ /* SkillHistoryEntry[] */ ]
}
```

**Import validation is load-bearing, not cosmetic.** The store's `keyPath` is `id`, so a
single entry without one throws inside `put()` and aborts the whole transaction — taking
every valid row with it. `parseBackup()` therefore rejects a bad envelope outright but
*filters* bad rows and reports the count, so a restore that saves most of the data beats one
that saves none.

**Merge vs replace** is chosen at import time, after the file's contents are on screen. Merge
composes (history via the worker's per-field merge; players by newest `metadata.updatedAt`).
Replace makes the stores match the file. Restoring onto an empty store behaves identically
either way.

Two things that look like mistakes and aren't:

- `clearSkillHistory()` and `exportSkillHistory()` return `null` on failure, not `0`/`[]` —
  an export that read failure as "no history" would save a plausible file with nothing in it.
- `importCaches()` writes the file's own key strings and never calls `generateStorageKey()`,
  which reads the game DOM and would send a restore into `team-unknown`.

`team-unknown` caches are deliberately excluded from export — `clearInvalidCaches()` deletes
them on every hockey page load, so backing one up would restore something that immediately
gets removed again.

## Verification status

The repo has no test runner, so "verified" means it was actually run.

| Area | Status |
|---|---|
| Export, end to end | **Verified in the browser.** 31,865 records / 7.9 MB. Settles the payload-size question — a file that size crosses `chrome.runtime.sendMessage` fine, so no paging or chunking is needed. |
| `parseBackup()` | **Verified.** 12 assertions against the compiled code (foreign files, unknown versions, missing `id`, `id` disagreeing with `playerId:date`, malformed dates, null rows). |
| `importCaches()` / `exportAllCaches()` | **Verified.** 8 assertions (newest-wins merge, union, replace dropping stale keys, the `team-unknown` exclusion, and that import writes the file's keys rather than a DOM-derived one). |
| Header layout with the notice | **Verified in the browser.** Measured at 1400px and 760px: no overflow, notice contained and full-width. |
| **Restore / import** | **NEVER RUN.** Not once, in any mode. |
| Clear All Data | **Never run.** |
| Squad-overview capture | **Never run in the browser.** |
| Auto-clearing notice, dialog focus trap | **Never run.** |

The harnesses that produced those 20 assertions were throwaway and are not in the repo —
there's no test runner to hang them on. Re-creating them is part of "add a test runner"
below.

## Outstanding work

**1. Finish the browser verification — restore first.** This is the next thing to do, and
the ordering matters: the backup feature exists to make Clear safe, and the half that has
never executed is the half that gives the data back. Export a file, import it with **Merge**
onto the populated store (a merge with itself should be a no-op, since entries are keyed by
`playerId:date`), and only then trust it enough to test Clear. After that: replace mode, a
deliberately malformed file, and Tab-cycling inside both dialogs.

One expected discrepancy while checking numbers: with more than one team cached, the file's
player count legitimately exceeds the header's `Total Cached`, because
`getAllPlayersFromAllCaches()` reads only `hockeyKeys[0]` while the backup keeps every cache.

**2. The `Has history` filter no longer means what it did.** It was added so it was visible
at a glance who still needed a gather run. Now that the overview page captures the whole
squad, everyone picks up an entry within a day — a player with one incidental day and one
with 22 gathered months both read as "has history". Sorting by the column still separates
them. Needs either a day-count threshold or an explicit "gathered" vs "seen" distinction.

**3. `PlayerGrowthChart` rebuilds on every keystroke.** It calls `destroy()` + `new Chart()`
on each age-filter change, and its `deep: true` player watcher rebuilds the whole chart on
any mutation without re-fetching history, so it would replot stale data. `CLAUDE.md`'s own
rule says prefer `chart.options` + `update()`; the comparison chart follows it, this one
doesn't.

**4. Add a test runner.** Vitest fits the existing Vite setup. The pure functions are the
obvious first targets and several already have assertions written for them once:
`parseBackup`, `importCaches`, `downsampleHistory`, `mergeEntry`, `daysBetween`,
`getSummaries`' key parsing, `historyEntryAge`.

**5. Cross-sport.** `SkillHistoryEntry.skills` is typed `HockeySkills` and
`readEntryBaseRating()` hardcodes `hockeyPlayerProfile`. Before soccer or basketball capture
can be added, settle whether PPM reuses player ids across sports — the entry id carries no
sport segment while the worker is shared by all three, so colliding ids would cross-
contaminate.

For bugs rather than features, see [known-issues.md](known-issues.md).
