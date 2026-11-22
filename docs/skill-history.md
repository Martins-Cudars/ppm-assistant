# Skill history

Everywhere else the extension keeps only the latest snapshot of a player. This is the one
store that remembers what a player looked like on a given day, so growth can be charted
against the projection instead of guessed at.

Built for hockey; basketball **capture** now runs too (see [Basketball](#basketball)). Growth
analysis is still hockey only, and nothing is wired into soccer.

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
  an OR. `mergeHistoryEntry()` (`src/storage/historyMerge.ts`) keeps incoming values where
  present and existing ones where the incoming entry is silent. A blind `put()` would let
  whichever ran last erase the other.
  - **Decimals are not replaced by the same values rounded down.** The squad overview and
    profiles show whole numbers; the training-progress page shows two decimals. A same-day
    overview visit used to turn 72.94 into 72 (found by the 2026-10-01 branch review).
  - Now the stored skills and their `source` are kept when the incoming ones are exactly
    the stored ones floored.
  - Decimals still replace stored whole numbers, so re-opening training progress (or
    re-gathering) repairs days flattened before the fix.
- **Summaries are derived from keys alone.** Since the id encodes player and date,
  `getSummaries()` uses `getAllKeys()` and never deserialises a record, so annotating a whole
  squad stays cheap at tens of thousands of rows.

Every value field on `SkillHistoryEntry` is optional. Consumers must filter for the field
they need — use the readers in `src/sports/hockey/skillHistoryChart.ts`, which also handle
the deprecated `kr` field (the old name for `overallRating`).

### The logged-out "Public account" (`src/storage/publicAccount.ts`)

When nobody is logged in, PPM shows a shared demo team, "Public account": basketball
`team.html?data=3323-public-account`, hockey 5289 "Public Account".
- **What went wrong:** the extension cached it as the user's team (2026-10-01). The report
  read the *first* team cache key, `team-3323` sorts before `team-39743`, and the Basketball
  tab showed 15 demo players instead of the user's 20.
- **Detection:** the page even has a "Log out" link, so login state can't tell it apart; only
  the header's own-team link can.
- Three layers now handle it:
  - **`src/main.ts`** does nothing on a public-account page (`isPublicAccount()`: a
    `public-account` slug, the name "Public account", or a known public id). No cache, no
    history, no UI.
  - **`pickTeamCacheKey()`**, used by both report readers: never a public cache, then the
    newest squad overview (falling back to the last write) when there are several teams.
  - **A background cleanup** on worker start removes public team caches and every history
    day of their players. It is idempotent and logs what it removed.

## Growth pace and projection

> **Potential: future XP (all sports, 2026-10-01).** Projected XP is today's XP plus the
> squad's **typical** share of the table's XP gain for each future year (since 2026-11-23,
> against the top-5% line's XP: hockey 0.58 / 0.52, soccer 0.43 / 0.40; against the old
> table they were 0.45 / 0.63 and 0.45 / 0.52; basketball `TYPICAL_XP_PER_SEASON`).
> - A player's own past share is no longer carried forward. It reflects playing time
>   wherever he was, not at this team.
> - **What found it:** Herberts Dzelzs, a soccer CF bought at 18 from an elite team, had 42 XP
>   at 19 (1.69× the table; the squad sits at 0.34–0.71). His own share took him to 401 XP
>   at 32 and a **1,235 potential: 5 diamond stars** for a ~685 rating. With the typical
>   share he projects ~150 XP and **891**.
> - His history also showed that the drop after the transfer was in **shooting** (his old
>   team trained it hard, 8–30 per 28 days; this team trains only the CF ratio skills, 0–6),
>   not in base training (~60% before, 62% now). His pace window is entirely at this team,
>   so the rating side was already right.
> - Future work: once daily captures hold a season of a player's XP at this team, his
>   measured in-team rate could replace the typical share.

> **Whole-number days can't be judged (all sports, 2026-10-01).**
> - **The bug:** days captured from the squad overview or a profile store integer skills, so
>   most normal training days show no change. `cleanedGains` skipped them as "no training"
>   while still counting the gain when a number ticked up. That gives a pace up to ~1.8×
>   too high.
> - **The fix:** only a 1-day step between two decimal entries is judged for flat days and
>   camps. A whole-number capture is recognised by its `source` (`PlayersList` /
>   `PlayerProfile`) plus integer skills. Everything else is kept and measured endpoint to
>   endpoint.
> - **Effect on the backup:** 19 hockey players, each with ~20 whole-number days since the
>   last gather, dropped by 1–9 points (e.g. 38% → 29%). Basketball and soccer barely
>   moved.
> - **Remaining bias:** a window ending on a whole-number day loses the fraction at its end,
>   under a point per trained skill, so it reads slightly low. Re-gathering restores the
>   decimals.

The logic now lives in the shared `src/base/growthModel.ts`; `src/sports/hockey/growthPace.ts`
binds it to hockey's constants. All pure functions. The same code drives:

- the Player Report's **Pace** column
- the Player Report's **Skill @25** and **OR @25** columns, and **Skill @32** / **OR @32**
  (all three sports, added 2026-10-01): the rating without XP and the OR behind Potential's
  stars. Both are recorded for players already 32 or older (hockey fetches the days around
  each one's 32nd birthday, as it does for 25), and projected otherwise. For a projected
  player, Skill @32 equals Potential's no-XP rating.
- the dashed **Projected at own pace** line on the profile chart

**Pace counts skill points, not rating movement.** A position's base rating is
`min(main / 1, sec1 / 0.5, sec2 / 0.5)`, so it only moves when the *bottleneck* skill moves.

- **Catching up the bottleneck.** Rating moves ~1:1 with points, while balanced training
  costs 2 points per rating point. Measured by rating, a 15-year-old who put nearly
  everything into defence read **98%**. The honest figure is **57%**.
- **Training a skill that isn't the bottleneck.** The rating doesn't move at all, so a
  player being trained hard reads near 0%.

**What the top-player curve measures.** Since 2026-11-23 (4.1.0) it is the top-5% line,
`relativeSkillReference` in `src/sports/<sport>/relativeSkillReference.ts`: the same line
the charts draw in grey and relative skill's global 100% reads. Pace, the projections,
`topExpAt` and the soccer reference after 23 all read it, so every "top player" number uses
one table. Before, they read `playerGrowthPrediction` in `settings.ts`, a hand-built table
that has been removed. The numbers in this section up to the age factors come from that
table. The line, like the old table, has ages 15–45 (soccer 15–40):

- **`skill` is the position rating *with* bonus, no XP.** That's the first two parts of
  "803 (502 + 64 + 237)" on the position card.
- **"Total"** is `skill × (1 + exp ÷ 500)`, the rating with XP. The card's % compares
  against Total.
- **The top-player OR** is the line's own `or` column (`relativeOrReference`), drawn and
  measured against in the charts' OR mode only. See "OR mode" under the Skill / OR toggle.
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
  - **Days that aren't normal training are skipped** (`cleanedGains()`):
    - **No-training days:** every one of the 7 skills flat, even for a single day. PPM has no
      rest days, so zero training means injured, too old, or no training selected. The test
      is *all* skills, not the position's main skills: on the Aug 28 backup, 23% of days left
      the main skills flat, but on 87% of those another skill grew. That day's training
      simply went elsewhere, and it counts. Only the other 13% were true no-training days.
      - If more than half the window has no training, nothing is skipped: the player isn't
        being trained, and the pace honestly reads low.
    - **Training camps:** 4+ consecutive days above 1.6× the window's median daily gain.
      The June 2026 camp showed as 12–14-day runs across the youth squad. Left in, it lifted a
      window by 15–25 points (Verpakovski 68% → 86%).
    - Only day-to-day intervals can be judged. Gaps and profile-only history are kept, and
      measured end to end as before.
    - Effect on current injuries: Mizis 46% → 61%, Vanteris 56% → 68%, Ābols 17% → 24%.
  - **Minimums, in measured days:**
    - 28 or more (`PACE_MIN_SPAN_DAYS`): a full pace.
    - 14–27 (`PACE_PROVISIONAL_MIN_DAYS`): a provisional pace, shown as `~61%` in grey
      italics. This covers newly arrived 15-year-olds.
    - Fewer than 14: `-`, and the tooltip gives the stored day count.
  - The tooltip gives the dates, the measured days and what was skipped.
- **Expected gain** at an age is the curve's slope for that year of age:
  `skill[floor+1] − skill[floor]`. Since 2026-11-23 it is the top-5% line's smoothed rate
  for that year (`smoothedSeasonGains()`, see "Pace slows with age"). There is no pace from
  35 on, where the curve declines.
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

> **Measured against the smoothed rate of the top-5% line (2026-11-23, 2026-11-22
> backup; the user's decision).** The line is a cross-section of many teams, and its yearly
> gains step where scouting is thin: hockey 90 a season at 15 and 33 at 26, between 121 and
> 59. Read against the raw steps, hockey 26-year-olds' Pace was 100–142%. So Pace and the
> projections measure against `smoothedSeasonGains()` (`src/base/relativeSkillFit.ts`): the
> gains fitted unimodal (rising to one peak, never rising again after it), then 1-2-1
> averaged three times. Hockey's rate: 15:90 16:103 17:107 18:103 20:97 22:90 24:71 26:45
> 28:30 30:21 32:17 34:4, negative from 35. Soccer uses it up to 23 (15:42 17:64 20:58
> 23:52) and the squad's own decline from 24, scaled to the smoothed 52 at 23. The line
> drawn on the charts is unchanged, so a 100% pace follows the smoothed rate, not the drawn
> line exactly.
>
> **The factors against that rate:** hockey **1.00 / 0.96 / 0.96 / 0.88** (27 / 11 / 11 / 3
> players, base pace 59% at ≤21); soccer, all history, **1.78 at 15, 1.23 at 16**, 1.00
> from 17 (26 / 28 / 27 players). Soccer's junior factors now scale its rate instead; see
> "Soccer juniors' Pace, corrected" below. Against the old table they were 1.00 / 0.95 / 0.67 / 0.49
> and 1.4 / 1.18; against the line's raw steps 1.00 / 0.93 / 1.03 / 1.00 and 1.74 / 0.80.
> `scripts/measure-age-factors.ts` takes `SPORT=soccer`. The rest of this section is the
> measurement against the old table.
>
> **Pace on the same backup: 4.0.1 (old table) → the line's raw steps → the smoothed rate:**
>
> | Player | Age | Pace | @25 |
> |---|---|---|---|
> | Gatis Spuļģis (W) | 22.4 | 81% → 83% → 88% | 789 → 793 → 797 |
> | Matīss Slaidins (W) | 16.4 | 60% → 80% → 80% | 673 → 857 → 843 |
> | Octave Bezeau (W) | 26.4 | 53% → 124% → 91% | – |
> | Mairis Grīns (W) | 28.4 | 48% → 81% → 95% | – |
> | Kristofers Vārna (soccer SD) | 22.7 | 60% → 81% → 64% | 455 → 481 → 462 |
> | Reinis Rītiņš (soccer SD) | 15.7 | 67% → 100% → 100% | 417 → 436 → 436 |
>
> Hockey 16-year-olds still project higher than in 4.0.1 (Slaidins 843 vs 673): the
> smoothed rate keeps the line's 90 a season at 15 (the fit keeps its ends), so a window at
> 15.9–16.4 reads 80%, and the line rises 874 from 16 to 25 against the old table's 853.
>
> **Soccer juniors' Pace, corrected (2026-11-23, the user's report).** Reinis Rītiņš, a
> 15-year-old with an average training ratio (71), read 100% Pace. Nothing clamped it and
> camps don't touch Pace. His window was 2026-09-25 to 11-20 (56 days, none skipped):
> 125.5 skill points a season, so 41.8 base a season (SD weights sum to 3), against the
> line's smoothed rate of 42 at 15. That rate is the fitted line's first step, kept as
> fitted: the rating/OR share is low and flat at 15–16 (0.219, 0.222, then 0.268 at 17),
> where few players with skills were seen. So every 15-year-old read high: on the backup
> the three 15-year-olds were the top three Paces (100–114%, ratios 71–78). The squad's
> best ratios (81–85) read 49–64%. Pace against training ratio was r = 0.15.
>
> The age factors 1.78 / 1.23 already corrected this for the projections, but not for the
> Pace column. They now scale the rate at 15 and 16 instead (`JUNIOR_RATE_FACTORS`, OR:
> `OR_JUNIOR_RATE_FACTORS` 1.35 / 1.23), and soccer's age factors are all 1.00. The
> projections are exactly as before, every player's @25 unchanged on the backup. Pace at
> 15–16 now reads on the 17+ scale: Rītiņš 56%, Evijs Lācis 114% → 64%, Gints Kaklarots
> 83% → 47%. Squad medians are 55% under 17 and 55% from 17, and Pace against training
> ratio is r = 0.40. Re-measuring with `measure-age-factors.ts` now reads 1.00 at 15, 16
> and 17+.
>
> Hockey shows no such junior effect: median Pace 84% under 17 and 83% from 17. Hockey
> Pace doesn't track training ratio (r = −0.15, 44 players). See "Why training quality
> is not in the model".

A single pace carried to 25 was too optimistic. At this team, players slow down faster than
the curve does, so projections multiply each future year by an age factor relative to ages
up to 21. These are measured with no-training and camp days skipped:

| From age | Factor | Players | Since Mar 2026 |
|---|---|---|---|
| ≤21 | **1.00** | 23 | reference, ~56% base pace |
| 22 | **0.95** | 12 | 0.95 |
| 25 | **0.67** | 13 | 0.71 |
| 28 | **0.49** | 4 | 0.51 |

Before skipping, these read 0.87 / 0.64 / 0.47. Much of the apparent slowdown after 21 came
from camps, which only young players get and which inflated the reference, and from
injuries. The real drop comes at 25.

**How it's applied**:

- A pace measured at age *a* is first divided by `agePaceFactor(a)`, giving the underlying
  pace. A 23-year-old at 50% is doing what a 20-year-old at ~57% would.
- Each future year then gains `underlying × curve step × agePaceFactor(that year)`, via
  `adjustedCurveGainBetween()`. Non-main skills are scaled the same way.
- A 100% on-curve player at 18 still stays on the curve up to 21. At 25 they reach **1080**
  instead of 1093: 450 + (101 + 98 + 97 + 95) + (97 + 78 + 77) × 0.95.
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
prints 1.00 / 0.95 / 0.67 / 0.49.

**Backtest on Octave**, who was actually 839 / 1825 at 25. Replaying the model at earlier
ages:

| Projected at | Projected | Error |
|---|---|---|
| 20 | 822 / 1788 | −2% |
| 22 | 815 / 1774 | −3% |
| 23 | 823 / 1788 | −2% |
| 24 | 847 / 1838 | +1% |

At 18 it overshoots by +17%. That window is his last two months at the elite team, so it's
the facility effect, not the model. At 22 the error went from −7% to −3%, once the 17 injury
days in that window were skipped.

### Camp allowance

Pace skips camp days, so it describes normal training. **But camps are a regular budget, not
windfalls.** The game lets a team send about 20 players to camp twice a season, with at most
14 camp days per player per 112-day season. The projection therefore adds them back.

**What the Aug 28 backup shows:**

- **A camp day gains 1.98× a normal day** (median over 466 camp days), so each camp day adds
  about one extra day of training (`CAMP_DAY_EXTRA = 1`).
- **Blocks come once a season.** They started Jul 13, Nov 2, Feb 23 and Jun 13, with full
  blocks of 13–14 days.
- **Only players under 22 go.** All 21 players seen at camp were 15.9–21.9, none older.
  That's `CAMP_UNTIL_AGE = 22`.

**How the allowance works:**

- **Per player, from his own record.** It counts the camp days in his last 112 days of
  history (0–14, `campDaysPerSeason`). Players you don't send get none.
- **New players:** with less than a season of history, the full 14 are assumed until his own
  record exists.
- **Report fetch:** the report fetches 112 days so the whole season is visible. The pace
  itself still uses the last 56.
- **The boost:** each year before 22 grows by `1 + camp days ÷ 112` on top of the age factor,
  via `adjustedCurveGainBetween(from, to, campDaysPerSeason)`. Every skill gets it, as camps
  boost all training.
- **Size of the effect:** it adds about **+6–7%** to @25 for 15–16-year-olds on the full 14
  days. It shrinks to 0–2% by 20–21, as fewer camp seasons remain.
- **Where it shows:** the @25 tooltip states the allowance, and the Pace tooltip shows the
  camp days last season.

### Stars and potential

The Player Report shows two star columns. Both use `RatingStars`, the same component as the
profile card. It shows 5 stars in three tiers, measured on rating **with XP**:
- **silver:** up to 600
- **gold:** up to 1500
- **diamond:** up to 2600

- **Skill ★** is today's position rating with XP, the same number as Pos Skill.
- **Potential ★** is the projected **peak**: rating with XP at `POTENTIAL_AGE = 32`
  (`projectPotential()`).
  - The rating comes from the same model as Skill @25 (pace, age factors, camp allowance),
    extended to 32.
  - Players already 32 or older show their current value. Past XP isn't stored, so their
    real peak can't be reconstructed.
  - Projecting to 32 is further out than 25, so it's less certain, especially for teenagers.
- **XP isn't in the skill history.** Only today's value is cached, so XP is projected
  (`projectExperience()`):
  - Each future year gains the top-player table's `exp` gain for that year × the player's
    share.
  - The share is his own share today (his XP ÷ the top player's at his age), but never
    below the squad's typical share for the age (`SQUAD_XP_SHARE`).
  - On the Aug 28 cache the typical share was 0.45 at 15–21 and 0.63 from 22. Young
    players get less ice time. The floor stops a new player with 0 XP from projecting none.
- **On the Aug 28 backup:** youth potential is ~1050–1325, all in gold. Veterans sit slightly
  above their current value (e.g. Ābols 1137 → ~1221).
- **A styling fix this needed:** the star SVGs are 500×500. The global `styles.css` shrinks
  them to 16px, but it only loads on game pages, so `RatingStars` now sets the same size
  itself. Without that, the report showed empty star cells.

## Profile chart: Skill / OR toggle

All three profile growth charts have a Skill / OR toggle (`src/components/GrowthMetricToggle.vue`,
state and session memory in `src/components/growthMetric.ts`). The choice is kept in
`chrome.storage.session`, which every sport subdomain, tab and the report page share; the
background worker opens that area to content scripts (`setAccessLevel`). The page's own
`sessionStorage` holds a copy, read first and used where the shared one isn't reachable.
Switching swaps `chart.data.datasets` and the y-axis title in place, then `chart.update()`;
it does not recreate the chart. Axis, legend and tooltip say "OR" in OR mode.

- **The Players reports' comparison chart** (`GrowthComparisonChart.vue`) switches in place
  too (2026-11-23): every series keeps its dataset, empty on a metric it has no points for,
  so dataset *i* stays series *i* and legend / Hide All choices survive the switch. Its y
  axis uses `growthMetricScale` (OR: not from zero, titled "OR"). Seen in a static harness
  from the 2026-11-22 backup: same chart instance after the switch, a hidden player still
  hidden.
- **An unscouted player** (no skills read) opens on OR, and the Skill view leaves out the
  "now" points, whose rating would be a guess from OR.

- **OR history, the same rule in every sport** (`overallOrSkillSum` in
  `src/base/historyDownsample.ts`): the row's `overallRating`, else the sum of its floored
  skills (OR = Σ floor(skill)), but only when every one of the sport's skills is in the row.
  A partial capture gives no OR rather than a false dip. An unscouted opponent's rating-only
  rows draw. Each sport's history reader (hockey `historyPoints()`, soccer
  `soccerHistoryPoints()`, basketball `historyPoints()`) is a thin wrapper over one helper,
  `historyChartPoints(entries, read, ageOf)`, which drops rows without a value before
  thinning. The OR y axis
  auto-scales with 5% padding instead of starting at zero. `orDatasets()` in `growthMetric.ts`
  builds the OR view for all three charts and omits "Now (OR)" when the OR is missing or 0.
  The comparison chart's Skill / OR tabs use the same `GrowthMetricToggle`. Rows are filtered per metric *before* thinning (see the Skill path above).
- **Hidden in OR mode:** the "with XP" lines and marker. OR has no XP.
- **Basketball's squad-best line** switches to its OR curve (`buildSquadBestCurve().or`).
- **Verified:** hockey and soccer, in a static harness against the 2026-11-22 backup. Basketball is
  compiled and linted only, not seen in a browser.

### OR mode: the top-5% OR line and the OR projection

> **Added 2026-11-23 (the user's request).** OR mode drew only history and "Now (OR)": a
> 17-year-old's chart was empty from 17.4 on. It now draws a prediction too.

- **All three sports** draw a grey **Top 5% (OR)** line, and a dashed **Projected at own
  pace (OR, NN%)** line from today's OR to the end of the range. Basketball measured
  against its squad's best until it moved to the top-5% line too (see "Basketball Pace on
  the top-5% line").
- **The line** is `relativeOrReference` in `src/sports/<sport>/relativeSkillReference.ts`.
  It is the fit's OR percentile (the `or` column) before the rating/OR share turns it into a
  rating. `scripts/fit-relative-skill.ts` writes it next to the rating table, so the script
  stays the single source. Re-running the script on the 2026-11-22 backup reproduced every
  row unchanged.
- **The model** is `src/base/orGrowth.ts`, bound per sport in `growthPace.ts` (hockey,
  soccer) and `growthModel.ts` (basketball).
  - **OR pace** is OR points per season ÷ the OR line's smoothed season gain
    (`smoothedOrSeasonGains`) at the window's middle age. This is the skill pace against
    the rating line, applied to OR. Soccer reads the line's rate up to 23. From 24 it
    reads the squad's same decline (`SQUAD_SLOPE_SHARE_FROM_24`), scaled to meet the OR
    rate at 23.
  - **Measured on skills** where the history has them: the skill pace's 56-day window
    and cleaning (no-training and camp days skipped), with every skill's points counted.
    OR is Σ floor(skill), so this is its growth.
  - **Measured on the OR numbers** where it has none: an unscouted player, seen only on
    his profile. The rate runs end to end over the same window, with the same 28 / 14-day
    minimums. OR is a whole number and these days are occasional visits, so no day can be
    judged a camp. The rate is therefore the calendar rate, camps included, and the
    projection adds no camp allowance on top.
  - **Skills come first.** Whenever the skill pace would accept a skilled window, the OR
    pace reads it, and OR-only days are ignored, as the skill pace ignores them. The OR
    numbers are read only without such a window, so the pace never depends on which
    capture came last. The window, cleaning and camp record are one function,
    `measureSkilledWindow()` in `src/base/gainCleaning.ts`, shared by the hockey/soccer and
    basketball skill paces and the OR pace.
  - **The projection** is today's OR + pace ÷ the age factor at the window's middle × the
    line's age-adjusted rise, with the camp allowance on the skills basis. It stops at 35,
    as the skill projection does.
- **Own age factors.** `scripts/measure-age-factors.ts METRIC=or` measures the OR pace like
  the base pace, over every window, including OR-only ones. Soccer's juniors differ: its
  rating line's smoothed gain at 15 is low against 17+ compared with the OR line's, so the
  base pace's 1.78 would divide a 15-year-old's OR pace too far. Soccer's junior values
  scale the rate at 15 and 16, not the pace (see "Soccer juniors' Pace, corrected").

  | Sport | Bands | Skill (base pace) | OR pace |
  |---|---|---|---|
  | Hockey (since 2025-12-01) | ≤21 / 22 / 25 / 28 | 1.00 / 0.96 / 0.96 / 0.88 | **1.00 / 0.94 / 0.94 / 0.78** |
  | Soccer (all history), junior rate | 15 / 16 / 17+ | 1.78 / 1.23 / 1.00 | **1.35 / 1.23 / 1.00** |

- **Basketball** measures OR growth the same way (`basketballOrModel()`, the same
  `createOrModel`): against its top-5% OR line's smoothed rate, with its own OR age factors.
  A player with skills is read on the skill pace's own window and camp record, over all
  seven skills.
- **On the 2026-11-22 backup** (OR @25, or at +3 years for players over 22). The Skill
  columns are the Player Report's: pace, Skill @25 and the OR of the same projected skills.

  | Player | Age | Skill pace | Skill @25 | Report OR @25 | OR pace | OR @25 |
  |---|---|---|---|---|---|---|
  | Gidons Verpakovskis (hockey) | 17.4 | 94% | 952 | 2050 | 95% | 2077 |
  | Matīss Slaidins (hockey) | 16.4 | 80% | 843 | 1802 | 72% | 1680 |
  | Octave Bezeau (hockey, @29) | 26.4 | 91% | 981 | 2115 | 85% | 2111 |
  | Mairis Grīns (hockey, @31) | 28.4 | 95% | 1117 | 2392 | 88% | 2394 |
  | Jānis Riekstiņš (soccer) | 17.7 | 57% | 456 | 1490 | 60% | 1595 |
  | Kristofers Vārna (soccer) | 22.7 | 64% | 462 | 1536 | 61% | 1537 |
  | Reinis Rītiņš (soccer) | 15.7 | 56% | 436 | 1399 | 52% | 1395 |

  From 18 the OR projection lands within ~1% of the report's OR @25 in hockey. Hockey's
  15–16-year-olds read ~7% lower: their OR factor is the ≤21 band's 1.00, measured mostly
  on older juniors. Soccer's 17–18-year-olds read 5–7% higher.
- **Unscouted players.** The backup holds no opponent with OR-only days at least 14 days
  apart (one hockey player has 2 visits a day apart), so the OR-only path was checked on
  real players with their skills stripped. Daily and weekly OR-only visits gave the same
  pace as the skills basis: Verpakovskis 95% and 2077 both ways, Indulis Propoliss 80% and
  1824. Slaidins gave 73–75% → 1599–1629 against 72% → 1680 on skills. His window holds a
  camp: the OR numbers keep it in the rate, but get no allowance on top.
- **Verified** in a static harness from the 2026-11-22 backup, on the real components with
  the history store mocked. Screenshots: hockey OR for a 17- and a 28-year-old, soccer OR,
  basketball OR, a synthetic unscouted hockey player (weekly OR-only visits, no skills),
  and the Skill → OR switch in place (hockey, soccer). The Skill view's screenshots
  (hockey 17 and 28, soccer) are byte-identical to the same harness built from 4.1.0
  before the change. **Not run in the extension.**

## Basketball

Basketball **does** have a training-progress page, the same as hockey's (`/en/training-progress`,
`/lv/treninu-progress`). It was first thought not to, which is why the daily capture below
shipped first. The page shows, per day:
- OR;
- all 7 skills with decimals;
- **height** (the `Hgt` / `Aug` column).

So history can be back-filled with the same **Gather history** walk as hockey. One player
checked on 2026-10-01 has months back to April 2024. The page logic is shared in
`src/base/trainingProgress.ts`, and each sport passes only its column map (basketball adds
`heightColumn: 9`). The pager, the month bounds and the `(T:…)` markers were verified
identical on the live site.

An early observation was that only one skill moves per day. The research below confirmed
it across the whole squad.

### Storage, per sport

Hockey's storage kept its names; each other sport got its own.

| | Hockey | Basketball |
|---|---|---|
| History (IndexedDB, same DB) | `skillHistory` | `skillHistory_basketball` |
| Player cache (`chrome.storage.local`) | `ppm-assistant:hockey:team-<id>` | `ppm-assistant:basketball:team-<id>` |
| Backup field | `skillHistory` | `sportSkillHistory.basketball` |

- **The worker is at `DB_VERSION` 2.** The upgrade only *creates* missing stores, so hockey
  data never moved.
- **Messages and APIs.** Every message and every client function takes an optional `sport`,
  defaulting to hockey. Hockey's callers didn't change.
- **Backup v2** adds `sportSkillHistory`. v1 files still import.
- **Clear All** clears every sport, matching the backup.
- **Ids can't collide.** With separate stores, an id reused across sports (whether PPM
  does that is still unknown) lands in different places.

### Capture (`src/sports/basketball/capture.ts`)

- **Squad overview:** the whole team goes into the cache, the roster is saved, and today's
  history is written.
- **Profile:** any player, including other teams'.
- **What each entry stores:** skills and OR, plus **height** and **XP**. Hockey never stored
  those.
  - Basketball's rating is `min(skill ÷ weight)` over 5 skills (Σw = 3.0 for every
    position), × a height modifier, so a projection needs the height.
  - XP can't be recovered later.
- **Ids.** The squad-overview parser keeps the whole profile *link* as the player id, so
  `normalizePlayerId()` pulls the number out (`data=` or the last path segment). It rejects
  anything else, so no phantom players.

### Research findings (2026-09-30)

**A basketball season is 70 days, not hockey's 112.** The game header reads
"Season: 64 (66/70)".
- The profile was first set to 112, copied from hockey, which made every date-to-age
  conversion wrong by a factor of 1.6. The user caught it: Valdis Eris showed "107 at 25"
  (PF, October 2023), but at 25 (November 2024) he was C 157.
- With 70 days, 18 of 20 players' histories start at exactly **15.0**, the age juniors join.
  With 112 they had scattered from 16.9 to 19.5.
- The ages below use 70-day seasons. Findings 1, 2 and 4 don't depend on age.

The data is the user's own squad: 20 players, 10,178 days (10,158 day-to-day diffs), from
September 2023 to September 2026, gathered with the training-progress walk. The ages covered
are 15 to 35; only one player (Valdis, who joined at 19) is past 27.

1. **Training: exactly one skill per day.**
   - Every one of the 10,158 diffs shows at most one rising skill. There were no multi-skill
     days at all.
   - The manager's schedule decides the skill; each player rotates through a set, e.g.
     `BPTV…`.
   - **Pace is therefore just total skill points per day.** Hockey's "unbalanced 15-year-old"
     problem (a split across skills) doesn't exist here.
   - Gains are very steady: the same skill in the same month varies by only ~3% (CV).
   - Gains barely depend on the skill trained: within a player-month the range is 0.95×
     (technical, blocking, speed) to 1.05× (aggression, jumping, shooting).
2. **No-training days are rare:** 1–7% of days up to age 27.
   - Runs are either 1–3 days or 9–19 days (injuries).
   - From 31, 22–38% of days *look* flat, but that is the gain rounding to 0.00 at the
     page's two decimals, not missing training.
3. **Camps: one team-wide 10-day window per 70-day season.**
   - Observed windows: 2024-05-31, 08-16, 10-25, 12-31; 2025-03-15, 05-24, 08-01, 10-11,
     12-20; 2026-03-01, 05-09, 07-18, 09-25.
   - This matches **the game rule (from the user): 5 × 2 = 10 camp days a season**.
     Projections cap the allowance at 10.
   - The camp record looks back 84 days, not 70, so that a camp in progress doesn't hide
     last season's full one.
   - Gains differ a lot by skill *for the same player* (one gained 0.74/day on speed and 1.13
     on passing). So basketball camp days are judged against the same skill's normal day
     (`perSkillCampBaseline`). Against the overall median, slow-skill camp days fell under
     1.6× and broke camps in two: one player read 0 camp days instead of 15.
   - **A camp day gives 2.0× a normal day** (median; p25–p75 1.82–2.13). Hockey's
     `CAMP_DAY_EXTRA = 1` holds.
   - Players were sent at ages 15–24, plus a handful of days at 25. Only 69 of 10,158 high
     days fell outside a window.
   - Hockey's camp rule (4+ days above 1.6× the median) works once judged per skill.
4. **OR = Σ floor(skill)**, exactly as in hockey. It matched 10,178 of 10,178 entries.
5. **Height grows linearly from 15, then stops.**
   - Growth is +1 cm at a steady per-player interval: **2.6–8.6 cm per season**.
   - It stops between **17.9 and 19.8**, most players around 19 (`HEIGHT_STOP_AGE`).
   - It never shrinks.
6. **XP (current snapshot only):**
   - about 0–4 at 16–17, ~10 at 19, ~17 at 21, ~30 at 23, ~38–47 at 25, ~55–67 at 26–28,
     and 96 at 35;
   - per season that is ~1 at 15–16, ~4 at 17–20, ~7–8 at 21–27, and ~4.5 from 28.
   - Daily history carries no XP, so it builds up only from the daily capture.
7. **Age curve** (pooled normal-day gain, camps excluded):

   | Age | 15–18 | 19–22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 |
   |---|---|---|---|---|---|---|---|---|---|---|---|---|
   | Gain per day | 0.88–0.93 | 0.80–0.81 | 0.78 | 0.75 | 0.64 | 0.55 | 0.48 | 0.23 | 0.17 | 0.13 | 0.08 | 0.03 |

   - From 28 on this is one player (Valdis), so the cliff after 27 is uncertain.
   - At 35 he declines by about 30 points a season.
   - The within-player and facility-step analyses from the first pass used 112-day ages and
     haven't been redone. The adaptive reference below doesn't need them.
8. **Season gain** (pooled, camps included, per 70-day season): 15–16 ≈ 70, 17–18 ≈ 65,
   19–22 ≈ 59–60, 23–24 ≈ 54, 25 ≈ 42, 26–27 ≈ 32–34, 28 ≈ 16, then down to ~0 by 33.

### Roadmap: what the captured data is for

Items 1, 2, 3, 6 and the XP part of 4 are answered in the research findings above. Item 5 is
sidestepped by the adaptive reference below, and item 7 is that reference.

Research can start as soon as the squad's past is gathered with the training-progress walk. It
no longer has to wait weeks for daily capture. Re-run hockey's analyses on basketball data, and
turn each answer into a constant documented like hockey's:

1. **Training split.** Do gains follow `trainingRatios` (e.g. PG 100/80/80/20/20), or is it
   one skill per day as the page suggests? Does training quality matter?
2. **No-training days:** all 7 skills flat. How common are they, and how long are the runs?
3. **Camps.** There's a camp page (`treninnometne`, route commented out). Find the days per
   season, the multiplier and the ages.
4. **XP share** by age.
5. **Age slowdown**, measured by comparing players over the same months. Make
   `scripts/measure-age-factors.ts` sport-aware.
6. **Height:** does it change with age? The training-progress page stores it per day, so gathered history answers this directly.
7. **Reference curve** from the user's own data, since there's no top-player table.
   - A level curve (rating by age) is possible now.
   - A growth curve needs the captured history.
   - It gets labelled "your squad", not "top player".

### Report and squad-rank card (done)

- **Report page: one tab per sport** (`ReportShell.vue`).
  - It opens on the sport in the URL. The basketball squad overview's "📊 Player Report"
    button opens `?sport=basketball`.
  - Otherwise it opens on the last tab used.
  - Each report loads its data only when its tab is shown.
- **`BasketballReport.vue`** has the same look as hockey's: `SortableTable`, plus heatmap
  and styles now shared in `@/components/heatmap.ts` and `@/components/reportTable.css`.
  - **Filters:** team (from the roster) and position (PG / SG / SF / PF / C).
  - **Column groups:**
    - Player: name, age, CL, OR, Exp, **Height**
    - Skills: the 7 skills, with the heatmap
    - Position: best position, Pos Skill, Skill ★ on the 300 / 600 / 900 scale, TQ
    - **All positions:** ratings for all 5. Basketball players move between positions,
      and height decides the fit.
    - Data: history days, last updated
  - **Growth:** Pace, Skill @25, OR @25, Skill @32, OR @32 and Potential ★ (see the growth model below). A
    collapsible "Pace reference" panel shows the curve and which player sets it at each age.
  - Backup and Clear stay on the Hockey tab; they already cover every sport.
- **Squad-rank card.** The card is now the shared `SquadRankCard.vue`, which is given a
  ranked subject, a squad loader and a profile link.
  - Hockey and basketball each have a thin wrapper around it.
  - The basketball profile sidebar shows it, e.g. "the 3rd best point guard".
  - Basketball ranks by best-position rating with XP, height included.
  - Players are rebuilt from the cache by `deserializeBasketballPlayer()`, which recalculates
    their positions.

### Basketball Pace on the top-5% line (2026-11-23, the user's decision)

> **Replaces the adaptive reference below.** Measured against the squad's best at each age,
> two 28-year-olds read 182% (Jozis Pupuķis) and 224% (Alvijs Lasis). After 27 that curve
> rested on one former player plus the default tail (0.23 points a day at 28). The median
> Pace was 101%, so 100% didn't mean top growth. Basketball now measures against its
> global top-5% line, as hockey and soccer do.

- **The rate** is the top-5% line's rating gain a season, no XP
  (`smoothedSeasonGains(relativeSkillReference)`), as rated-skill points a day:
  gain × 3 ÷ 70. Every position's five rated-skill weights sum to 3, so a balanced rating
  point costs 3 of them. On the 2026-11-22 line: 34 a season at 15, 38 at 16, 31 at 18,
  27.5 at 21–24, 25 at 26, 20.5 at 27, 13.4 at 28, 7.3 at 29, 0.8 at 34.
  `BASKETBALL_REFERENCE_CURVE` replaces `buildReferenceCurve` and `DEFAULT_REFERENCE`,
  which are removed.
- **Pace** counts the points in the five rated skills only. Shooting and blocking feed the
  game engine's bonuses, not the rating. It uses the same 56-day window, cleaning and camp
  record as before (`measureSkilledWindow`).
- **Projections** divide the pace by the age factor it was measured at, then spend the
  line's age-adjusted rated points with the camp allowance. They are spent balanced per
  position, as before. Shooting and blocking keep their own observed rate along the same
  curve, as hockey's non-main skills do.
- **Age factors** (`scripts/measure-age-factors.ts SPORT=basketball ERA_START=2000-01-01`,
  all history, because no facility change is known):

  | Bands | ≤21 | 22–24 | 25–27 | 28+ |
  |---|---|---|---|---|
  | Players | 23 | 11 | 7 | 3 |
  | Skill (rated) pace | 1.00 (50%) | 1.00 | 0.84 | **0.84**, measured 0.68 |
  | OR pace | 1.00 (65%) | 0.81 | 0.47 | **0.47**, measured 0.41 |

  28+ rests on 3 players, too few, so it carries the 25–27 factor. After 27 only the line's
  smoothed rate slows further (the user's rule: where data is thin, the smoothed rate).
  Since 2025-12-01 the bands hold 19 / 9 / 5 / 1 players and read 1.00 / 0.94 / 0.79 / 0.37.
  The OR line's rate peaks at 25–26 (145 a season, against 95 at 15–21), so the OR factors
  fall further.
- **Charts.** The profile chart draws "Top 5% (with XP)" and "Top 5% (no XP)" in Skill mode
  and "Top 5% (OR)" in OR mode, as hockey and soccer do. It no longer reads the squad's
  history. The report's Squad choice draws the top-5% line on the Skill tab and the squad's
  best OR on the OR tab, as hockey's and soccer's do. Its "Pace reference" panel shows the
  line's rate.
- **On the 2026-11-22 backup**, squad best → top-5% line. Pace, @25 (or +3 years) Skill and
  OR, then OR pace and the OR view's projection:

  | Player | Age | Ratio | Pace | Skill @T | OR @T | OR pace | OR view @T |
  |---|---|---|---|---|---|---|---|
  | Jozis Pupuķis (@31) | 28.7 | 80 | 182% → 55% | 252 → 249 | 1003 → 992 | 182% → 44% | 1008 → 991 |
  | Alvijs Lasis (@31) | 28.7 | 76 | 224% → 70% | 241 → 237 | 957 → 941 | 224% → 54% | 961 → 940 |
  | Edmunds Grāmatiņš (@28) | 25.7 | 82 | 120% → 66% | 293 → 296 | 1140 → 1148 | 120% → 47% | 1143 → 1160 |
  | Marks Rafaļskis | 17.7 | 75 | 106% → 61% | 295 → 276 | 1125 → 1052 | 106% → 90% | 1130 → 1174 |
  | Ģirts Zemļinskis | 15.7 | 81 | 100% → 61% | 292 → 299 | 1197 → 1223 | 100% → 91% | 1200 → 1301 |

  The projections barely move: both references fall with age at about the same rate, and
  the projection spends rate × reference. Pace now reads on a top-5% scale: squad median
  61% (was 101%), at most 86%, with nobody at 150% or more. The 28-year-olds read 55–70%,
  their current 56-day windows, above the 28+ median of 34% over all history.
- **Pace against training ratio** (24 own players with a pace): r = 0.17 (was 0.15). The
  medians by ratio are 69% at ≤74, 56% at 75–79 and 66% at 80+. Top five: Ivo Īlentiņš
  (15.7, ratio 83) 86%, Matīss Snepsts (19.7, 74) 78%, Boriss Šoriņš (17.7, 72) 75%, Inārs
  Skrastiņš (22.7, 79) 73%, Juris Meiers (21.7, 85) 72%. As in hockey, Pace doesn't track
  the ratio. There is no junior inflation like soccer's: the 15-year-olds read 28–86%.
- **Not run in the extension.** The profile chart was seen in the static harness. The report
  was only built.

### Growth model: adaptive reference (`src/sports/basketball/growthModel.ts`, until 2026-11-23)

The user's idea: **the best squad player at each age counts as 100%.** Basketball has no
top-player table, and the squad's own best trained under the same facilities and coaches.
This also sidesteps the unsettled age-curve question (research item 7).

- **Reference curve** (`buildReferenceCurve`), rebuilt from all stored history on every
  report load:
  - Per player and whole age: skill points per normal day. No-training and camp days are
    skipped with the shared `src/base/gainCleaning.ts`, which hockey uses too.
  - A player counts at an age with ≥28 measured days, mostly day by day. That keeps sparse
    profile-visit history of other teams' players out.
  - Take the best player's value at each age, then make the curve **non-increasing after
    the peak** (pool-adjacent-violators). The raw best is jagged: 24 read 0.96, above 23's
    0.89, only because a different player was best.
  - Ages without data come from `DEFAULT_REFERENCE` (this research's smoothed curve),
    scaled to meet the nearest measured age.
  - On the Sep 2026 backup: 1.25 at 15 (the peak, 13 players), 1.13–1.15 at 16–18, 1.03 at
    19–20, 0.91 at 22–24, 0.76 at 25, 0.60 at 27, then 0.23 at 28 (one player), down to 0
    at 33.
- **Pace** = skill points per normal day over the last 56 days ÷ the reference at the
  window's midpoint age.
  - It is provisional from **7 days** (hockey: 14), because daily gains are steady.
  - It is full at 28 days.
  - Several players read ~100%, because the current best players are measured at their own
    current age. That is by design: "as good as your best at this age".
- **@25 projection** (`projectBasketball`):
  - Points = pace × the reference's points from now to 25.
  - Camp days are added at 2×: the last 84 days' count, capped at 10, until age 25.
  - Shooting and blocking keep their current share of training.
  - The rest goes into the five rated skills, spent balanced for each position (bottleneck
    first). The best resulting position wins, so a growing junior can project into another
    position.
  - Height keeps its observed rate until 19 (`HEIGHT_STOP_AGE`).
  - Players already 25 or older show the value recorded in history instead.
- **Potential ★:** the same model extended to 32, plus XP: today's XP plus the squad's
  typical rate from here (`TYPICAL_XP_PER_SEASON`, read off the cache snapshot). A player's
  own past rate isn't carried forward; see "Potential: future XP" under Growth pace.
- **Sanity check on real data** (70-day seasons):
  - Valdis's recorded @25 is C 157.
  - Juniors project to OR ~920–1120 at 25, against 830–910 recorded for today's
    25–27-year-olds.
  - Skill @25 is ~230–345 for juniors, against 188–224 recorded.
  - The model extends today's training rates, which are higher than when the current
    25-year-olds were juniors.

### Charts (`src/sports/basketball/historyChart.ts`)

- **Profile chart** (`BasketballGrowthChart.vue`), mounted right below the profile box. The
  basketball layout has no `.column_center_inner`: the table sits in a `.white_box` in
  `.column_center_half`. It shows:
  - grey: the top-5% line, with and without XP, as hockey and soccer draw it (until
    2026-11-23: your squad's best rating on reaching each whole age, `buildSquadBestCurve`);
  - red: today's best-position rating, with and without XP;
  - blue: stored history, each day rated with that day's height;
  - dashed blue: the projection at the player's own pace, the same model as the @25 column.
- **Report → Growth Comparison tab:** every filtered player by age on the shared
  `src/components/GrowthComparisonChart.vue`.
  - It has a Skill / OR toggle, an age range, Hide / Show All, and the same squad-best
    grey line.
  - **Side list instead of Chart.js's legend** (2026-11-23, all three sports): players
    grouped by best position (`groupOrder`: hockey G/D/W/C, soccer and basketball their
    position lists, "?" in Other), with a name search (accent-insensitive), a tri-state
    checkbox per group, and swatch, name, age and checkbox per row. The reference line has
    its own row above the groups. Hovering a row, or reaching it by keyboard, thickens that
    line and dims the others (not for a hidden row or one with no points on the metric),
    in place with `chart.update("none")`; a clicked checkbox keeps the focus but doesn't
    keep the highlight; the points' colours are scriptable
    and follow the line, because Chart.js keeps shared point options on a `"none"` update.
    Hidden lines are kept by series id in the component, so they survive a metric,
    reference or filter change.
  - **Full screen** (toolbar button): the Fullscreen API on the whole card, white
    background, chart and list filling the height. Esc or the button leaves;
    `fullscreenchange` keeps the icon in step and calls `chart.resize()`.
  - Seen in the real report page in headless Chrome, restored from the 2026-11-22 backup
    (hockey 38 players, soccer 31, basketball 23). Not seen: a real Esc key press (headless
    CDP keys don't reach the browser's Esc handler; `document.exitFullscreen()`, the same
    page-side path, was checked).
  - The component takes prebuilt series, so hockey's report could move to it too.
- History is thinned to one point per ~14 days by the shared
  `src/base/historyDownsample.ts`, which hockey re-exports.
- Neither chart has been seen in a browser yet.

### Scouted rosters: the ELITE and LEAGUE lines (2026-10-02)

Basketball has no ideal-growth data, and the squad-best line only reaches as high as the
user's own players. The user's idea: collect real data from other teams and draw the best
OR at each age. **OR only for now** - a roster page shows no skills - and the growth model
(Pace, @25, @32, Potential) is unchanged.

- **Two groups, both "the best OR at each age":**
  - **ELITE**: among every captured player, whoever the team.
  - **LEAGUE**: among players of the teams in the user's current league.
- **A point per quarter of a season, not per whole age** (`bestOrByAge()`,
  `LEVEL_PARTS_PER_SEASON`; changed 2026-10-09). Each point sits at its snapshot's exact
  age.
  - With one point per whole age the winner was always a late-season snapshot. Rosters
    scouted on day 68 of 70 put the "age 15" point at 15.97. On day 5 of the next season
    the new 15-year-olds (15.07) were more than half a season before the line's start:
    the line began at 16 and their "OR vs best" was "-".
  - Within one age, a later quarter below an earlier one is dropped: it is a visit that
    saw fewer teams. So a veteran's decline inside one season is not drawn.
- **Capture is on visit only** - no automated walk over other managers' pages (the user's
  choice). Three pages feed it:

| Page | View | Stores |
|---|---|---|
| Any team's Players page: `/en/players.html?data=<teamId>`, `/lv/speletaji.html` | `viewTeamRoster.ts` | one snapshot per player |
| The user's squad overview | `viewPlayerList.ts` | the same snapshot for the user's own players |
| The league table: `/en/league.html`, `/lv/liga.html` | `viewLeague.ts` | the league's team ids |

- **The roster table** (checked live): `# Name Fun ScP Age Hgt AvQ CL Con Popularity OR`, 11
  columns in both languages. Read by position (`parsers/teamRoster.ts`), because the headers
  are translated; a table with another column count is ignored. The user's own Players page
  has the same layout. The team name comes from `.ppm_menu_top_profil_name a`.
- **Snapshots** (`src/types/ScoutSnapshot.ts`) live in their own object store per sport,
  `scoutSnapshots_<sport>` (`DB_VERSION` 4), not in the skill history: reports, summaries
  and `buildReferenceCurve` read that store as "the user's squad".
  - Each row: `playerId`, `name`, `date`, `teamId`, `teamName`, `age`, `season`,
    `seasonDay`, `overallRating`, `height`, `averageQuality`, `careerLongevity`, `source`.
  - Age, season day and team are stored **per snapshot**, because players age and move.
  - AvQ, CL and height aren't used yet. They are stored so the later research (training
    per season, the effect of age and career longevity) needs no second round of visits -
    that research needs the same player seen twice, weeks apart.
  - Same-day repeats merge per field (`src/storage/scoutMerge.ts`).
- **The league list** is one record in `chrome.storage.local`
  (`ppm-assistant:basketball:league`): season, league id (`lva-iii-3`), name, team ids.
  - One league has several tables. Late in a season the default league page is the
    relegation round: 8 of 16 teams, and on 2026-10-02 it did not include the user. "League
    standings" lists all 16.
  - So `nextLeagueTeams()` treats a page as the user's league when it is the default page
    (no `data` in the URL), or the user's team is in the table, or it is the league already
    stored. Tables of the same league and season add up; a different league or a new season
    **replaces** the list, so promotion and relegation follow the next visit.
  - A table of any season but the current one (the header's) is ignored: the user's team
    is in last season's standings too, and browsing them must not bring back a league
    since left.
  - The league and season come from the page's `season` / `country` / `league_level` /
    `league_number` selectors. The user's own team is always in the list.
  - LEAGUE is filtered at read time by each snapshot's own `teamId`, so a player who has
    since left the league still counts for the day he was seen there.
  - If a snapshot is from a later season than the list, the caption says the list is old.
- **The lines** (`scoutReference.ts`): per whole age, the highest OR among all snapshots at
  that age, plotted at that snapshot's exact age (age + season day ÷ 70). The tooltip names
  the player and team. One player can be the best at several ages.
- **The toggle** is in the shared `GrowthComparisonChart.vue` (`referenceOptions`): Squad
  best · League · Elite. On the Skill tab only Squad best is available.
  - The reference is always the first dataset, so switching it swaps the data in place and
    keeps the legend and Hide All selections.
  - A caption says what the line is built from, e.g. "Elite: best OR at each age among 212
    players from 14 teams".
- Each capture page shows a one-line "PPM Assistant: stored ..." note above the table,
  since capture is otherwise invisible.
- **Not seen in a browser yet**: the two views, the notes, the toggle.

#### The report table: "Compare with" Squad / League / Elite

One toggle above the tabs drives the chart's reference line (`v-model:reference-key` on the
shared chart) and two table columns. The choice is remembered in `localStorage`.

- **What the scouted data is.** Pace is a *rate*; a roster visit gives a *level*. A rate
  needs the same player seen twice, weeks apart. So the toggle does two different things:
- **"OR vs best" (works from single visits):** the player's OR as a percentage of the
  group's best OR at his exact age. `bestOrAt()` reads the group's line: linear between
  points, the end value up to half a season past either end, "-" beyond. Squad uses
  `buildSquadBestCurve().or`.
- **Pace against League / Elite (needs revisits):**
  - `scoutRatePairs()`: per player, the latest snapshot against the earliest one 42-105
    days before it **on the same team**; OR change ÷ days, at the middle age. 42 days,
    because each whole-number OR can sit several points under the true sum of the skills.
  - `groupRateByAge()`: per age the **mean of the 3 fastest** players (the user's choice -
    one alone is the luckiest rounding), non-increasing after the peak
    (`smoothFromPeak()`, split out of `buildReferenceCurve` and shared). Ages nobody was
    measured at take the squad curve's shape, scaled to the nearest measured age.
  - The player's side is `ownOrRate()`: his own OR change per calendar day over the last
    56 days of history (28 minimum). Both sides are calendar days and OR, so they are
    like for like - and both include camp and no-training days, unlike the squad Pace,
    which is per normal training day. The two numbers are not interchangeable.
  - **A group needs 10 pairs from other teams** before its pace is used
    (`scoutedPairCount()`). The user's own squad is snapshotted on every overview visit, so
    counting it would make every group "ready" within weeks and measure the squad against
    itself. Once a group is ready, the user's players are part of it like anyone else's.
    Until then the Pace column stays
    on Squad and the caption under the toggle says how many players were seen twice. When
    it switches, the column header reads "Pace vs Elite".
- **Projections do not follow the toggle** (the user's choice). In `projectBasketball` the
  points are pace × the reference between two ages, so the reference's level cancels and
  only its shape over ages would change anything; the scouted curve is OR-based and new.
  Skill/OR @25, @32, Potential and the "Pace reference" panel stay on the squad model.
- Never run in a browser. With the store new on 2026-10-02, the group pace cannot show
  before mid-November 2026 at the earliest. (Update: the user tested basketball's
  toggle, chart and "OR vs best" on 2026-10-04 - "works great".)

### Every sport: the shared scouting code (`src/base/scout/`, 2026-10-04)

Basketball's scouting moved out of `src/sports/basketball/` so every sport shares it.
Hockey was the first to follow; soccer is next.

| File | What it is |
|---|---|
| `rosterParser.ts` | Roster rows by a per-sport `RosterLayout` (`BASKETBALL_ROSTER`, `HOCKEY_ROSTER`), `profileHrefOf` (the name cell's link with a numeric `data=` that isn't the country flag), `teamIdFromHref`, `parseLeagueIdentity` |
| `scoutCapture.ts` | A row as today's snapshot; storing a page's rows for a sport |
| `squadSnapshots.ts` | The own squad overview's players as snapshots (each sport's `viewPlayerList` calls it) |
| `viewTeamRoster.ts`, `viewLeague.ts` | Factories: `viewTeamRoster(sport, layout)` and `viewLeague(sport)` give each sport's route its view |
| `scoutReference.ts` | The lines, pairs and group rates. Every age reading takes the sport's `daysPerSeason`; the group curve's gaps take a `shape(age)` function - basketball passes its reference curve, hockey `expectedSeasonGain`. Also `squadBestOrByAge`, the squad's best OR on reaching each age |
| `useCompareWith.ts` | The report toggle as a Vue composable: options, captions, "OR vs best", the shown Pace and the chart's reference options. Each report passes its own squad pace, squad reference and history readers |

- `smoothFromPeak` moved to `src/base/smoothFromPeak.ts`. The shared chart's types moved
  to `src/components/growthChartTypes.ts`, since `tsc` can't read types out of a `.vue`
  file.
- **Hockey specifics** (read from the live game on 2026-10-04):
  - The roster has 10 columns, `# Name Fun ScP Age AvQ CL Con Pop OR`, with no height.
  - Profile links go to `player.html` / `speletajs.html`.
  - The league page is `league.html` / `liga.html`, and its default page lists all 20
    teams. Seasons are 112 days.
- **The hockey report** now:
  - reads the whole hockey history once on load, the read the backup does (~33k rows);
  - has the toggle and "OR vs best";
  - uses the shared chart. `PlayerGrowthComparisonChart.vue` is gone.
- **Under Squad in hockey:**
  - Pace is unchanged, measured against the top-player table.
  - The chart's Skill line is still the top-player curve.
  - "OR vs best" and the chart's OR line use the squad's best OR at each age, which the
    old chart never had.
- **The squad's own line leaves out opponents** (`squadHistoryOnly`, both reports): a
  profile visit stores another team's player in the history too, and one seen near a
  birthday would have become "your squad's best". Only players with a squad-overview,
  training-progress or legacy day count. On the 2026-10-01 backup it drops 31 of hockey's
  73 history players; hockey's 16-age line came out the same either way.
- Basketball's report runs on the same composable.
- **Optimised on 2026-10-04** (after a review across all three sports):
  - **One history read per report.** `src/storage/historyQueries.ts` works out summaries,
    storage stats, each player's recent window and the days around a birthday from the
    full export the report already reads. Each mirrors its worker query.
    - Hockey went from 7 history requests (2 full reads, 3 key scans) to 1.
    - Basketball and soccer went from 3 requests to 1.
    - Replayed on the 2026-10-01 backup against the worker's key-based logic: 0
      mismatches in all three sports.
    - The worker's SUMMARY / STATS / LATEST_WINDOW / NEAR_DATES messages now have no
      callers. They are kept for now.
  - **Shared toggle UI.** `src/components/CompareWithBar.vue` (the row and caption),
    `src/components/PercentCell.vue` (both cells) and `compareColumns()` from
    `useCompareWith` (both column definitions) replace three copies.
  - **Roster note.** A `SCOUT_COVERAGE` message counts players, teams and ages in the
    worker, instead of sending every snapshot to the page to count. Its chart option is now named "Squad"
  (it was "Squad best").
- Hockey's capture, toggle and chart: **never run in a browser.**
- **Soccer** followed the same day, with hockey's choices: under Squad, Pace stays against
  soccer's reference table, and the OR line and "OR vs best" use the squad's best OR.
  - The roster (`/en/players.html?data=<id>`, `/lv/speletaji.html`) has hockey's 10
    columns (`SOCCER_ROSTER`). The league page is `league.html` / `liga.html`. Seasons are
    112 days. The report already read the whole history; it gains the toggle, "OR vs best"
    and the shared chart's reference options.
  - Read from page text and the accessibility tree only - scripts can't run on the soccer
    site. **Not confirmed:** the league dropdowns' `name` attributes (`season`,
    `country`, `league_level`, `league_number` in the other sports). If they differ, the
    league page saves nothing and shows no note.
  - Abandoned "noname" teams list players at OR 9; they can't be best at any age.
  - Never run in a browser.

## Soccer

Soccer is built like hockey, not basketball:
- the shared `calculatePositions` with a 0.35 bonus cap;
- 8 positions and 9 skills;
- a top-player table (`playerGrowthPrediction` in `settings.ts`);
- **112-day seasons** (the header reads "Season: 54 (25/112)");
- secondaries at exact fractions of the main skill (402 → 201/301), so training is
  position-split.

The user chose hockey's growth model, generalised. The work is phased like basketball.

### Phase 1: plumbing and capture (done)

- **Sport plumbing.** `"soccer"` is in `SPORTS`, which gives the `skillHistory_soccer` store
  (the worker is at `DB_VERSION` 3, add-only), the cache keys
  `ppm-assistant:soccer:team-<id>`, the backup's `sportSkillHistory.soccer` and a Soccer
  report tab.
- **Routes in both languages**, checked on the live menu:
  - `overview-of-players`, `player`, `players-practice`, `lineup`, `player-market`,
    `training-camp`, `training-progress`.
  - Soccer used to be Latvian-only, so nothing ran for an English player.
- **Parsers** live in `src/sports/soccer/parsers/players.ts`, shared by the views and
  capture. Ids come from the profile link, never the country flag.
- **Capture** (`src/sports/soccer/capture.ts`):
  - the squad overview stores the cache, roster and today's history;
  - a profile stores any player;
  - an unscouted player gives an OR-only day, and BasePlayer's estimated XP is never stored.
  - The id, date and number helpers are shared in `src/base/captureUtils.ts`.
- **Training progress plus Gather walk:** `viewTrainingProgress.ts` passes the 9 skill
  columns to the shared `runTrainingProgressView`.
- **The report tab is a phase-1 stub:** squad, history days per player and totals, enough
  to check the gather.
- **Public account:** soccer's id isn't known, so it's caught by slug and name.
- **Verification limit:** Chrome automation can't run scripts on the soccer domain; page
  text and screenshots work.

### Phase 2: research findings (2026-10-01)

The data is the user's FC Skanste: 31 players, 21,223 days, gathered with the Gather walk on
2026-10-01.

1. **The age mapping is right.** Histories start at 15.0–15.9, the age juniors join, so
   112-day seasons are confirmed. Basketball's 112-vs-70 mistake doesn't apply here.
2. **Bug found: OR cut at the English thousands comma.**
   - The training-progress page prints "1,598", and `parseFloat` stopped at the comma, so
     8,436 soccer days were stored with OR 1.
   - Fixed by `stripThousands()` (in `base/captureUtils.ts`, used by the shared parser).
   - Stored days are repaired once by the worker, using `repairedOverallRating()`. That is
     safe because OR = Σ floor(skill) holds on every other day in all three sports.
   - A dry run on the backup repaired exactly the 8,436, with 0 mismatches left.
3. **Training: one skill a day, but at the position's ratios.**
   - 96% of days raise exactly one skill (4% are flat).
   - Over a season the gains land on the position's ratios. An SM gains technical 0.52,
     speed 0.75, passing 0.54 and heading 0.25 of its midfield gain, against ratios 0.5 /
     0.75 / 0.5 / 0.25.
   - So hockey's measure applies directly: points into the position's skills ÷ Σweights.
   - Bonus shooting gets ~0.5 of main for SM/CM, ~0.75 for SF/CF and ~0.2 for defenders.
4. **Camps:**
   - runs of **7 or 14 days** at **2.0×** a normal day (p25–p75 1.93–2.11);
   - mostly 14 camp days per player per season, matching the rule (user: 2 × 7 = 14 a
     season);
   - used up to age 21–22, like hockey: `CAMP_MAX_DAYS_PER_SEASON` 14, `CAMP_UNTIL_AGE` 22.
5. **The top-player table is fine as a level up to 23, wrong as a growth shape after it.**

   | Age | 15–18 | 19–21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 |
   |---|---|---|---|---|---|---|---|---|---|---|
   | Squad, median base gain per season | 44→37 | 32 | 29 | 27 | 25 | 24 | 19 | 16 | 12 | 10 |
   | Table slope | 62–68 | 65–70 | 60 | 50 | 20 | 15 | 10 | 7 | 5 | 3 |
   | Reference slope used | table | table | table | table | 46 | 44 | 35 | 30 | 22 | 19 |

   - Against the raw table a typical player read ~50% up to 23, then 124–230% at 24–27.
   - **User's choice:** the table up to 23; from 24 the reference follows the squad's own
     decline, scaled to meet the table at 23 (`own[age] / own[23] × 50`).
   - Measured against that, pace stays ~0.53–0.55 at 24–28, the same as for juniors, so
     **no separate age factors are needed** (all 1.0).
   - 15–16-year-olds read higher (0.6–0.7) as they catch up; that is left in, as in hockey.
   - Ages 30–34 are extrapolated (one player): 14, 9, 5, 2, 0.
6. **XP share** of the table's `exp`: ~0.45 under 22 (0.34–0.71) and ~0.52 from 22. Used as
   the floor, as in hockey.
7. **Level:** the squad's best rating is ~60–70% of the table's level at 18–25 (e.g. 447 vs
   720 at 25), as with hockey's youth paces.

### Phase 3: report tab and squad-rank card (done)

- **`SoccerReport.vue`**, with the same look as the other sports:
  - team filter (roster, remembered) and position filter (GK, SD, CD, SM, CM, SF, CF);
  - column groups:
    - Player: name, age, CL, OR, Exp
    - Skills: the 9 skills, with the heatmap
    - Position: best position, Pos Skill, Skill ★ on 400/800/1200, Pos TQ (only when
      training qualities were read)
    - All positions: all 7
    - Data: history days, last updated
  - **Table / Growth Comparison tabs.** The comparison uses the shared
    `GrowthComparisonChart`, with the top-player table as the grey Skill reference. The
    table has no OR column, so the OR view has no reference.
  - Chart data lives in `src/sports/soccer/historyChart.ts`: best-position rating with bonus,
    no XP, the hockey convention.
- **`SoccerSquadRank.vue`** in the profile sidebar, ranked by best-position rating with XP.
  - `SquadRankCard` now takes **per-sport `positionNouns`**, since codes clash: soccer's SF is
    a side forward, basketball's a small forward.
  - Soccer's nouns: goalkeeper, side defender, centre-back, side midfielder, central
    midfielder, side forward, centre forward.
- Growth columns (pace, @25, potential) and the profile chart are phase 4.

### Phase 4: shared growth model, pace / @25 / potential, profile chart (done)

- **One growth model for hockey and soccer.** `src/base/growthModel.ts` holds hockey's model
  as `createGrowthModel(config)`.
  - Every function is unchanged, with the constants moved into a `GrowthConfig`: skills,
    positions, bonus cap, season length, table, `referenceSlopeOverrides`, age factors,
    pace windows, camps, XP shares, max/potential age, and the camp-detection options.
  - `src/sports/hockey/growthPace.ts` is now hockey's config and re-exports the same names.
    Hockey's 52 checks pass with the test file unedited.
- **Soccer config** (`src/sports/soccer/growthPace.ts`): the phase 2 constants.
  - The table up to 23, the squad shape from 24.
  - Camps 14 / 2× / until 22, judged **per skill** (one skill a day).
  - XP shares 0.45 / 0.52.
  - **Age factors 1.4 at 15 and 1.18 at 16** (1.0 from 17). Juniors pace 0.70 / 0.59
    against ~0.50 from 17. Without these, a 15-year-old's catch-up pace was carried to
    25: ~554 projected, where today's 25-year-olds reached 410–450. With them, juniors
    project 405–470.
- **Dry run on the real backup:**
  - paces mostly 50–64%;
  - recorded @25 for the 25+ players (e.g. CD 447, SD 422/436, CF 431);
  - camp days ≤ 14;
  - one outlier: a 19-year-old with 42 XP (1.7× typical) projected a potential of 1,235,
    because his own XP share was extrapolated. Fixed by the XP rule ("Potential: future
    XP" under Growth pace): he now projects 891.
- **The Soccer report gets a Growth group:** Pace, Skill @25, OR @25, Potential ★, with
  hockey's tooltips. Pace's tooltip names the reference for that age.
- **Profile chart** (`SoccerPlayerGrowthChart.vue`) rebuilt on hockey's pattern:
  - top-player table base and with XP;
  - today's points;
  - history (`soccerHistoryPoints`);
  - the own-pace projection;
  - an age filter.
  - It now mounts below the profile box at full width; `.profile_player_center` alone was
    too narrow. The old `renderPotentialChart` in `src/charts.ts` has no users left.

## Relative skill: fitted from scouted rosters (4.1.0, 2026-11-22)

Relative skill is the best position's rating with XP as a percentage of a top player's at
the same exact age. Before 4.1.0, hockey and soccer divided by `playerGrowthPrediction`,
a hand-written guess, and basketball showed nothing. Now every sport shows two values:
"87% / 95%" means 87% against every scouted team and 95% against the viewer's league. A
tooltip says which value is which. Both values appear on the profile's ability box, the
player list's Rel column and the market's Rel column.

- **Global line: static, generated.** `src/sports/<sport>/relativeSkillReference.ts` holds
  `relativeSkillFit`: per age, the 95th percentile of scouted OR (`or`), the best
  position's rating as a share of OR (`share`) and XP (`exp`). `relativeSkillReference` is
  the same line as a `{ age, skill, exp }` table, with skill = share × or. To refresh it
  after more scouting, run `scripts/fit-relative-skill.ts <backup.json> --write`
  (`--compare` prints the user's players before and after). The script refuses to write
  NaN, Infinity or non-positive rows.
- **League line: fitted in the background worker** (`src/storage/leagueReferenceFit.ts`,
  2026-11-23). A view's entry point (profile, player list, market) calls
  `loadLeagueReference(sport)` once with the page's season; the worker reads the league
  list first, and only if there is a current one reads the snapshots, fits the league
  against the static global line and sends back the table (about 30 rows), not the store.
  It caches the table per sport, keyed on the list and the store's version (count plus a
  write counter). `leagueLine(sport)` in `src/base/scout/leagueRelativeSkill.ts` holds the
  answer reactively: Vue components re-render when it arrives, and the market's DOM cells
  are redrawn.
- **Only the list's season counts.** Snapshots of the league's teams from other seasons are
  left out (a team may have been in another league). A list from an earlier season than
  the page's is stale: no league line. On the 2026-11-22 backup this leaves hockey II.4 540
  league player-seasons (1,203 before), soccer II.2 569 (unchanged, one season scouted) and
  basketball III.3 273 (502 before); all three still fit (30, 24 and 22 measured ages).
  Basketball's league is thin past 26: 1–7 players per age.
- **Missing values show "???"** with no rank colour, and the tooltip says why: "87% / ???"
  without a league line ("League: not enough scouted players from your league this season
  (N found, 50 needed)", "League: league list is from season X; open your league page to
  refresh it", no list, still loading), "??? / ???" outside the table's ages ("No reference
  for age 46") or for an unscouted player ("Unscouted player: skills unknown"). Rows with a
  global "???" sort last in either direction.
- **The model is pure.** `player.getRelativeSkillMaxima(leagueTable)` takes the table as a
  parameter and starts no I/O.
- **Snapshots without a season** get one from their date where the store's dated
  snapshots pin the calendar down (`withDerivedSeasons`); within a day of a season boundary
  they stay out, and the rest are counted in a one-time warning. The 2026-11-22 backup has
  none.
- **One implementation.** `src/base/relativeSkillFit.ts` holds the fitting, and both the
  script and the runtime use it.
- **Reading it.** `player.getRelativeSkillMaxima()` returns `{ global, league }`, with null
  where there is none; `getMaxSkillForAge()` still returns the global value. Outside the
  table's ages (hockey 15-45, soccer and basketball 15-40), the cell shows "–" with no
  rank colour, and the lists sort those players last in either direction. The lists read
  the maxima once per player and sort by global, then league.
- **The growth charts use the same global line** as their grey "Top 5%" line: the hockey
  and soccer profile charts, both list charts and the Players reports' Skill tab. So the
  chart's top line and relative skill's 100% agree. Since 2026-11-23 Pace, the projections
  and their XP read it too: the growth rate is the line's yearly gains smoothed, with
  `AGE_PACE_FACTORS` and the XP shares re-measured against it (see "Pace slows with age").
  Basketball moved to its own top-5% line the same day (see "Basketball Pace on the top-5%
  line"); its XP is still the squad's typical rate.
  The grey lines use Chart.js's monotone interpolation: the plain spline bulged above the
  data at the axis edge (near 32.8 with ages 25-33 shown), even with the data smooth.
- **The method:**
  1. **OR reference (global).** Each player counts once per season, using his latest
     snapshot. For each whole age, the line is the 95th percentile of OR in a one-season
     window centred on that age. Before the percentile is taken, each point moves along a
     rough first-pass curve to that age, so a window's late-season players don't lift it.
     The first pass uses full windows only; its first ages continue the next two ages'
     slope, because at 15 nobody is younger. A window with fewer than 25 points widens by
     quarter seasons, up to ±2 seasons. The curve is then fitted to rise to a peak and
     fall after it, weighted by each age's count. A 1-2-1 average of each inner age then
     removes the fit's flat blocks and steps, which charts drew as bumps (hockey 34-36
     level, then a drop at 37). The average keeps a single peak.
  2. **League.** For each age, the league's 95th percentile (windows of at least 3 points,
     up to ±1 season) is taken as a ratio to the global curve. That ratio is shrunk toward
     a weighted linear trend of all the ratios, held within the measured ratios' range: an
     age with n points weighs n against the trend's 25. So an age with three veterans
     leans on its neighbours.
  3. **From OR to rating.** A roster shows OR only. Players with full skills give, per
     age, the best position's rating as a share of OR. They come from every cache of the
     sport, one record per player, plus history days with skills. The share rises from
     about 0.30 at 15 to 0.452 for adults in hockey (soccer 0.29, basketball 0.25), and
     never falls.
  4. **XP is set, not fitted** (`xpCurve`, the user's choice, 2026-11-22). The median XP of
     the players with XP, about 6 per age and mostly the user's own, was about 100 at 28.
     Elite players have about 200 at 28 in hockey and soccer, and about 150 in
     basketball (the user's figures; basketball changed 2026-11-22, round 4). The anchor
     is set per sport (`expAt28` in the script); the shape is the same in every sport:
     - exactly 0 at 15, when a player arrives from the youth facilities or the draft;
     - a per-season gain rising linearly from 0 at 15 to the full rate at 20 (juniors play
       less), then constant to 28, where XP reaches the anchor. The full rate is the
       anchor / 10.5: ≈ 19 a season at 200, ≈ 14 at 150;
     - after 28, 0.85 × that rate (≈16 a season). Scouted hockey veterans sit on it: 299 XP
       at 34, 362-368 at 39-40, 394 at 42.
     - The values, hockey and soccer: 15:0 16:2 17:8 18:17 19:30 20:48 22:86 25:143
       28:200 30:232 35:313 40:394 45:475. Basketball: 15:0 16:1 17:6 18:13 19:23 20:36
       22:64 25:107 28:150 30:174 35:235 40:296.
     - The script's `--exp-at-28` (overrides the per-sport anchor for every sport run, so
       pair it with `--sport`), `--exp-ramp-until` and `--exp-late-rate` retune it. The
       median is printed as `medXP` for comparison only.
- **Numbers on the 2026-11-22 backup.** Hockey had 2,177 scouted player-seasons (1,203 in
  the league), soccer 1,025 (569), and basketball 710 (502). With the 200-XP curve, the
  global line as rating with XP is 0.85-1.03× the old hand-written table in hockey from 16
  to 43 (lowest at 33-39, above it at 44-45) and 0.84-1.52× it in soccer (above it from
  25, because the old soccer table stopped gaining XP early). Basketball's league (III.3)
  is weak past 27, with two to five players per age at 0.4-0.6 of the global line, so its
  league line rests on the trend there.
- **The user's sanity check: Grīns (28, OR 2270) read 87% globally with the median XP; with
  the 200-XP curve he reads 74% / 80%.** His XP is 105, about half a top player's, so his
  rating with XP falls well short. Before the XP change: The I.1 players
  the user named are in the sample: Deputat (28.38, OR 2712) and Sējējs (27.94, 2739).
  The top 12 at 28 run from 2871 to 2493, so the sample has no lower-division bias at the
  top. Grīns's OR alone is about 84% of the 95th percentile (about 2717 at 28.4). He reads
  3 points higher because his rating/OR share (0.466) and XP (105) beat the age's typical
  ones (0.452, about 100). The XP of the top I.1 players is unknown, since roster pages
  show no XP. If it is higher, 100% would sit higher.
- Colour classes stop at 100: above 100% keeps the 100% colour, where before it lost its
  colour.
- Basketball's list and profile parsers now pass the real season day instead of 1. Before,
  every basketball player's age reading started at day 1.
- Checks: `test/relative-skill.check.ts`. Seen only in a static harness rendered from the
  backup, with the league fitted by the runtime code from the backup's league snapshots.
  It has not run on the live game, so the worker read and the redraw after it are
  unverified.

## Backup format

Both stores in one JSON file (`src/types/Backup.ts`, `src/storage/backup.ts`):

```jsonc
{
  "format": "ppm-assistant-backup",  // absent -> rejected outright
  "version": 3,                      // 1, 2 and 3 accepted; unknown -> rejected outright
  "exportedAt": "2026-08-30T…",
  "extensionVersion": "3.2.0",
  "playerCaches": { "ppm-assistant:hockey:team-12345": { /* PlayerCacheStorage */ } },
  "skillHistory": [ /* hockey's SkillHistoryEntry[] - the field every version has */ ],
  "sportSkillHistory": { "basketball": [ /* v2+: every other sport, by sport */ ] },
  "scoutSnapshots": { "basketball": [ /* v3+: ScoutSnapshot[], other teams' rosters */ ] },
  "leagues": { "basketball": { /* v3+: LeagueTeams, the user's league */ } }
}
```

Scouted data follows the same rules as history: rows are filtered like history entries, a
failed read aborts the export, Replace makes the store match the file (so a v1 or v2 file
empties it), and Clear All removes it. In a merge the newer league list wins.

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
| Pace / projection / @25 math | **Verified.** 52 assertions in `test/growth-pace.check.ts`, plus replays of the Aug 28 backup: the catch-up player goes from 98% to 57%, every balanced player stays within 3 points of its rating-based pace, 14 of 15 players aged 25+ get a recorded @25 value, and the Octave backtest lands within 7% from age 20 onward. |
| Pace and @25 columns, projection line, `SKILL_HISTORY_LATEST_WINDOW`, `SKILL_HISTORY_NEAR_DATES` | **Never run in the browser.** The worker's key-then-get read has no test at all. |
| **Restore / import** | **NEVER RUN.** Not once, in any mode. |
| Clear All Data | **Never run.** |
| Squad-overview capture | **Never run in the browser.** |
| Scouted rosters (basketball, hockey, soccer) | Parsing, merge, league list and the lines: **verified**, 23 checks in `test/scout-reference.check.ts`. The page markup was read from the live game (basketball 2026-10-02, hockey and soccer 2026-10-04, EN and LV). Basketball tested in the browser by the user on 2026-10-04. Hockey, soccer and the v3 backup round trip: **never run in the browser.** |
| Auto-clearing notice, dialog focus trap | **Never run.** |
| 4.1.0 review fixes (worker league fit, ??? display, comparison chart in place, unscouted basketball profile, shared session metric) | Checks in `test/relative-skill.check.ts` and `test/basketball-capture.check.ts`; the comparison chart's OR switch seen in a static harness. **Never run in the extension**: the worker message, `chrome.storage.session` access and the redraws are unverified. |
| OR mode: top-5% OR line and OR projection (all three profile charts) | 15 checks in `test/or-growth.check.ts`; hockey, soccer and basketball OR mode, an OR-only (synthetic unscouted) player and the in-place switch seen in a static harness from the 2026-11-22 backup; Skill view screenshots identical to before. **Never run in the extension.** |

The assertions live in [`test/`](../test/README.md), kept as-is because the *cases* were
the expensive part to work out. `pnpm check` (`scripts/run-checks.mjs`) bundles and runs
every file; a real runner is still item 4 below.

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

**4. Add a test runner.** Vitest fits the existing Vite setup. Since 2026-10-04 `pnpm check`
runs all 13 check files in one command (`scripts/run-checks.mjs`), which replaced the
throwaway `vite.check.mts`. A real runner would add watch mode and per-case reporting.
Untested still: `downsampleHistory`, `parseEntryKey` and `historyEntryAge`.

**5. Cross-sport - storage done, growth model not yet.** Every store is now keyed by sport, so
reused ids can't collide (see [Basketball](#basketball)). What's left is the growth model:
`growthPace.ts` still imports hockey's settings directly. Split it into a sport profile when
basketball's growth work starts (roadmap phase 4), shaped by what the research finds, not
guessed now.

For bugs rather than features, see [known-issues.md](known-issues.md).
