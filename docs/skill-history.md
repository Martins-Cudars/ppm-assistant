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

**What the top-player curve measures.** `playerGrowthPrediction` (`settings.ts`) is a
hand-built table, ages 15–45:

- **`skill` is the position rating *with* bonus, no XP.** That's the first two parts of
  "803 (502 + 64 + 237)" on the position card.
- **"Total"** is `skill × (1 + exp ÷ 500)`, the rating with XP. The card's % compares
  against Total.
- **There is no top-player OR.**
- Pace originally counted base growth only, and read every winger and centre 15–20 points
  low, since shooting feeds their bonus at 0.45.
- **Evidence** (Aug 28 backup, own players 21 and under): with bonus growth included, a
  player's pace matches his current level as a share of the curve.

| Player | Base-only pace | With bonus | Level vs curve |
|---|---|---|---|
| Verpakovski | 55% | 75% | 75% |
| Laimītis | 53% | 73% | 73% |
| Ansons | 53% | 70% | 70% |

The youth median went from 55% to 66%.

**The definitions:**

- **Pace.**
  - **Base part:** the skill points per season that went into the best position's main
    skills, divided by the weights' sum (2 for every hockey position).
  - **Bonus part:** the bonus skills' points per season times their bonus weights, e.g.
    0.45 × shooting + 0.1 × defence for a winger.
    - While the bonus sits at its 0.6 × base cap, it can only rise with the base, so it
      counts as 0.6 × the base part.
  - **Pace** = (base + bonus) ÷ the top-player gain per season at the same age.
  - **`basePace`** is the base part alone. Projections spend main-skill points from it, and
    project bonus skills at their own rates, so the bonus isn't counted twice. The age
    factors are measured on it too.
  - **The tooltip** shows points, base, bonus and rating per season. When the base itself
    moved noticeably faster or slower than the points explain, it adds a hint that the
    skills are unbalanced.
- **Window.**
  - The last 56 days (`PACE_WINDOW_DAYS`) before the player's latest day *with skills*,
    not before today. It was 28 days at first, but single months proved too noisy: one
    player ranged 52–64% month to month, and a projection from his best month overshot by 15%.
  - There must be at least two such days, 28 or more days apart (`PACE_MIN_SPAN_DAYS`).
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
  - Future main-skill points are
    `pace ÷ agePaceFactor(now) × 2 × (age-adjusted curve gain from now to 25)`. That carries
    both the curve's slowdown and this team's slowdown after 21 and 24; see
    `AGE_PACE_FACTORS` below.
  - `solveBalancedRating()` spends those points where they raise the rating most: the
    bottleneck first, then all main skills together. Any skill already ahead counts as paid
    for.
  - Non-main skills keep their own observed rate. An example is shooting, which feeds a
    winger's bonus.
  - The result goes through `calculatePositions()`, which applies the 0.6 bonus cap.
  - The model assumes balanced training for the current best position from here on.
  - A balanced player on the curve at 100% stays on the curve up to 21, and follows the
    age-adjusted curve after that. Both invariants have tests.
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

### Pace slows with age: `AGE_PACE_FACTORS`

A single pace carried to 25 was too optimistic after 21. At this team, players train at a
steady ~58% of the curve up to 21, then slow down faster than the curve does. So projections
multiply each future year by an age factor, relative to ages 16–21:

| From age | Factor | Players | Across three slicings |
|---|---|---|---|
| ≤21 | **1.00** | 23 | reference, ~58% base pace (~66% with bonus) |
| 22 | **0.87** | 12 | 0.86 / 0.88 / 0.91 |
| 25 | **0.64** | 13 | 0.62 / 0.64 / 0.68 |
| 28 | **0.47** | 4 | 0.46 / 0.48 / 0.50 |

**How it's applied**:

- A pace measured at age *a* is first divided by `agePaceFactor(a)`, giving the underlying
  pace. A 23-year-old at 50% is doing what a 20-year-old at ~57% would.
- Each future year then gains `underlying × curve step × agePaceFactor(that year)`, via
  `adjustedCurveGainBetween()`. Non-main skills are scaled the same way.
- A 100% on-curve player at 18 still stays on the curve up to 21. At 25 they reach **1060**
  instead of 1093: 450 + (101 + 98 + 97 + 95) + (97 + 78 + 77) × 0.87.
- The **Pace** column is unchanged. It shows the measured pace, not the underlying one.

**Why we compare players over the same months, not each player's own history.** The
training facilities changed several times over ten seasons, and some players arrived from
elite teams.

- **Octave Bezeau**, for example:
  - He averaged ~64% at an elite team up to 18.
  - He averaged ~50% on 12/15 facilities after his transfer.
  - He dipped to 37–48% at 21–22.
  - He rose back to ~55% after the upgrade around Nov 2025.
- One player's history therefore mixes facility levels, and can't measure an age effect.
- Different players over the same months all train under the same facilities, which is
  exactly what "how will he grow **here**" needs.
- The factors come from 56-day windows since 2025-12-01, after the last upgrade, on the
  Aug 28 backup.
- The same reasoning means past facility changes don't affect the Pace column either: it
  only ever looks at the last 56 days.

**The 28+ band rests on 4 players,** and 22–24 on 12. To re-measure as history
accumulates, or after the next facility or coach change, run
`scripts/measure-age-factors.ts`. It uses the real `measureGrowthPace()`, and its header
says how to run it. Then copy the factors into `AGE_PACE_FACTORS`. On the Aug 28 backup it
prints 1.00 / 0.87 / 0.62 / 0.47.

**Backtest on Octave**, who was actually 839 / 1825 at 25. Replaying the model at earlier
ages:

| Projected at | Projected | Error |
|---|---|---|
| 20 | 841 / 1828 | 0% |
| 22 | 784 / 1709 | −7% |
| 23 | 823 / 1788 | −2% |
| 24 | 847 / 1838 | +1% |

At 18 it overshoots by +28%, but that window is his last two months at the elite team
(81% pace). That's the facility effect, not the model.

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
| Pace / projection / @25 math | **Verified.** 34 assertions in `test/growth-pace.check.ts`, plus replays of the Aug 28 backup: the catch-up player goes from 98% to 57%, every balanced player stays within 3 points of its rating-based pace, 14 of 15 players aged 25+ get a recorded @25 value, and the Octave backtest lands within 7% from age 20 onward. |
| Pace and @25 columns, projection line, `SKILL_HISTORY_LATEST_WINDOW`, `SKILL_HISTORY_NEAR_DATES` | **Never run in the browser.** The worker's key-then-get read has no test at all. |
| **Restore / import** | **NEVER RUN.** Not once, in any mode. |
| Clear All Data | **Never run.** |
| Squad-overview capture | **Never run in the browser.** |
| Auto-clearing notice, dialog focus trap | **Never run.** |

The 67 assertions live in [`test/`](../test/README.md), kept as-is because the *cases* were
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

**4. Add a test runner.** Vitest fits the existing Vite setup. Four files in
[`test/`](../test/README.md) are already written and passing — `parseBackup()`,
`importCaches()`/`exportAllCaches()`, `growthPace.ts` and `squadRank.ts`, 67 assertions — they just need a runner instead of the
throwaway vite-bundle-then-node dance the README describes. After that, the obvious next
targets are `downsampleHistory`, `mergeEntry`, `daysBetween`, `parseEntryKey`, `getLatestWindowEntries` and
`historyEntryAge`.

**5. Cross-sport.** `SkillHistoryEntry.skills` is typed `HockeySkills` and
`readEntryBaseRating()` hardcodes `hockeyPlayerProfile`. Before soccer or basketball capture
can be added, settle whether PPM reuses player ids across sports — the entry id carries no
sport segment while the worker is shared by all three, so colliding ids would cross-
contaminate.

For bugs rather than features, see [known-issues.md](known-issues.md).
