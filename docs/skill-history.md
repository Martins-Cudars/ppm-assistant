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

## Growth pace and projection

`src/sports/hockey/growthPace.ts` holds the logic, all pure functions. The same code drives:

- the Player Report's **Pace** column
- the Player Report's **Skill @25** and **OR @25** columns
- the dashed **Projected at own pace** line on the profile chart

**Pace counts skill points, not rating movement.** A position's base rating is
`min(main / 1, sec1 / 0.5, sec2 / 0.5)`, so it only moves when the *bottleneck* skill moves.

- **Catching up the bottleneck.** Rating moves ~1:1 with points, while balanced training
  costs 2 points per rating point. Measured by rating, a 15-year-old who put nearly
  everything into defence read **98%**. The honest figure is **57%**.
- **Training a skill that isn't the bottleneck.** The rating doesn't move at all, so a
  player being trained hard reads near 0%.

**The definitions:**

- **Pace.**
  - Start from the skill points per season that went into the best position's main skills.
  - Divide by the weights' sum (2 for every hockey position).
  - Divide again by the top-player gain per season at the same age. "Top-player" means
    `playerGrowthPrediction`.
  - The tooltip also shows how fast the rating itself moved, and it flags the case where
    that differs.
- **Window.**
  - The last 28 days (`PACE_WINDOW_DAYS`) before the player's latest day *with skills*,
    not before today.
  - There must be at least two such days, 14 or more days apart (`PACE_MIN_SPAN_DAYS`).
  - The tooltip gives the dates.
- **Expected gain** at an age is the curve's slope for that year of age:
  `skill[floor+1] − skill[floor]`. There is no pace from 35 on, where the curve declines.
- **@25 columns: one value per player, from one of two sources.**
  - **Players 25 and over** show the value recorded when they turned 25, in normal text.
  - **Younger players** show a projection, in italic grey with a leading `~`.
  - Both kinds sort together, so a 19-year-old's projection ranks against what a
    27-year-old actually reached. On the Aug 28 backup, 14 of 15 players aged 25+ have a
    recorded value.
- **Recorded @25.**
  - The date is `today − (age − 25) × 112 days`, which assumes one calendar day per
    season day, like `historyEntryAge()`.
  - Take the stored day with skills nearest that date, within ±14 days.
  - Skill is `bestPositionRating()`, the best position with no XP. OR is the stored OR.
  - Read with `SKILL_HISTORY_NEAR_DATES`: keys first, then only the days around each
    target.
- **Overall rating is Σ floor(skill)** over the 7 skills. It matched all 16395 stored days
  and all 68 cached players. Training-page skills are fractional, and a plain sum
  overshoots (404.64 for an OR of 403). So **projected OR** is `overallFromSkills()` of
  the same projected skills behind Skill @25.
- **Projected Skill @25.**
  - Future main-skill points are `pace × 2 × (curve gain from now to 25)`. Using the
    curve keeps its slowdown with age.
  - `solveBalancedRating()` spends those points where they raise the rating most: the
    bottleneck first, then all main skills together. Any skill already ahead counts as paid
    for.
  - Non-main skills keep their own observed rate. An example is shooting, which feeds a
    winger's bonus.
  - The result goes through `calculatePositions()`, which applies the 0.6 bonus cap.
  - The model assumes balanced training for the current best position from here on.
  - A balanced player on the curve at 100% lands exactly on the curve. That invariant has
    a test.
- **Report data.** One message, `SKILL_HISTORY_LATEST_WINDOW`.
  - The worker reads keys first, then only each player's window, so it never reads the
    full store.
  - It returns null on failure, which shows as `-` rather than as 0%.

### Why training quality is not in the model

The per-skill training qualities seem like they should matter. **The data says they
don't**, at least for how gains split between skills. Checked against the Aug 28 backup
(37 own-team players):

- **The two secondary skills gain within ~5% of each other**, however far apart their
  qualities are: sd of the log gain ratio is 0.051. Examples: 52 vs 86 gives 25.7 / 25.5,
  and 56 vs 94 gives 21.6 / 22.6.
- **The main skill gains 2× a secondary**: exp(0.70) ≈ 2.0. That's the 1 : 0.5 : 0.5 split
  in `trainingRatios`.
- **The gain split doesn't track quality**: regressing log gain ratio on log quality ratio
  gives r = −0.03 over n = 1013 windows.
- **Overall pace doesn't track quality either**: position quality r = −0.08,
  `averageTrainingRatio` r = −0.13.

Weighting points by quality would have made the numbers worse. Re-run this check before
adding it.

### Known limitation: pace falls with age faster than the curve

Across the squad, pace runs about:

| Age | Pace |
|---|---|
| 16–22 | ~50–65% |
| 23–25 | ~35–58% |
| 26+ | ~7–42% |

Holding one pace ratio to 25 is therefore optimistic in a teenager's last few years before
25. A possible fix is an age profile calibrated from the user's own squad.

**Past facility changes don't affect Pace or the @25 projections.** The user's team upgraded its
training facilities at some point; the date is unknown. Pace uses only each player's last
28 days, so every player is measured under the current facilities. The age gap above is a
same-period comparison, so the facility history doesn't explain it either. In 2025–2026,
ages 24–29 run ~39–44% and ages 15–23 run ~50–60%.

**It would matter for any age-profile calibration** built from longitudinal history.
Median pace by age band and half-year (Aug 28 backup) shows no upgrade step anywhere since
2022. Instead, the same age bands ran *faster* early on. For example, 15–17 ran 91% (2022
H1), 75%, 66%, then settled around 50–55% from 2023 H2. The reason isn't established. It
could be:

- the upgrade predates the history;
- survivorship, since only the players still on the team had their history gathered;
- some other change in 2023.

A calibration should use only windows from one stable era: roughly 2023 H2 onwards.

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
| Pace / projection / @25 math | **Verified.** 28 assertions in `test/growth-pace.check.ts`, plus replays of the Aug 28 backup: the catch-up player goes from 98% to 57%, every balanced player stays within 3 points of its rating-based pace, and 14 of 15 players aged 25+ get a recorded @25 value. |
| Pace and @25 columns, projection line, `SKILL_HISTORY_LATEST_WINDOW`, `SKILL_HISTORY_NEAR_DATES` | **Never run in the browser.** The worker's key-then-get read has no test at all. |
| **Restore / import** | **NEVER RUN.** Not once, in any mode. |
| Clear All Data | **Never run.** |
| Squad-overview capture | **Never run in the browser.** |
| Auto-clearing notice, dialog focus trap | **Never run.** |

The 48 assertions live in [`test/`](../test/README.md), kept as-is because the *cases* were
the expensive part to work out. There's no runner to hang them on yet — `test/README.md`
shows how to run them meanwhile, and wiring them up is item 4 below.

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
"Has a pace" is now a third candidate, and probably the most useful one.

**3. `PlayerGrowthChart` rebuilds on every keystroke.** It calls `destroy()` + `new Chart()`
on each age-filter change, and its `deep: true` player watcher rebuilds the whole chart on
any mutation without re-fetching history, so it would replot stale data. `CLAUDE.md`'s own
rule says prefer `chart.options` + `update()`; the comparison chart follows it, this one
doesn't.

**4. Add a test runner.** Vitest fits the existing Vite setup. Three files in
[`test/`](../test/README.md) are already written and passing — `parseBackup()`,
`importCaches()`/`exportAllCaches()` and `growthPace.ts`, 48 assertions — they just need a runner instead of the
throwaway vite-bundle-then-node dance the README describes. After that, the obvious next
targets are `downsampleHistory`, `mergeEntry`, `daysBetween`, `parseEntryKey`, `getLatestWindowEntries` and
`historyEntryAge`.

**5. Cross-sport.** `SkillHistoryEntry.skills` is typed `HockeySkills` and
`readEntryBaseRating()` hardcodes `hockeyPlayerProfile`. Before soccer or basketball capture
can be added, settle whether PPM reuses player ids across sports — the entry id carries no
sport segment while the worker is shared by all three, so colliding ids would cross-
contaminate.

For bugs rather than features, see [known-issues.md](known-issues.md).
