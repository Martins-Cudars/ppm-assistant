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
  an OR. `mergeEntry()` keeps incoming values where present and existing ones where the
  incoming entry is silent. A blind `put()` would let whichever ran last erase the other.
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
> squad's **typical** share of the table's XP gain for each future year (hockey 0.45 / 0.63,
> soccer 0.45 / 0.52, basketball `TYPICAL_XP_PER_SEASON`).
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

The logic now lives in the shared `src/base/growthModel.ts`; `src/sports/hockey/growthPace.ts`
binds it to hockey's constants. All pure functions. The same code drives:

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
  - **Growth:** Pace, Skill @25, OR @25 and Potential ★ (see the growth model below). A
    collapsible "Pace reference" panel shows the curve and which player sets it at each age.
  - Backup and Clear stay on the Hockey tab; they already cover every sport.
- **Squad-rank card.** The card is now the shared `SquadRankCard.vue`, which is given a
  ranked subject, a squad loader and a profile link.
  - Hockey and basketball each have a thin wrapper around it.
  - The basketball profile sidebar shows it, e.g. "the 3rd best point guard".
  - Basketball ranks by best-position rating with XP, height included.
  - Players are rebuilt from the cache by `deserializeBasketballPlayer()`, which recalculates
    their positions.

### Growth model: adaptive reference (`src/sports/basketball/growthModel.ts`)

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
  - grey dashed: your squad's best rating on reaching each whole age (no XP), from
    `buildSquadBestCurve`. It is the level counterpart of the pace reference; hockey draws a
    top-player table here;
  - red: today's best-position rating, with and without XP;
  - blue: stored history, each day rated with that day's height;
  - dashed blue: the projection at the player's own pace, the same model as the @25 column.
- **Report → Growth Comparison tab:** every filtered player by age on the shared
  `src/components/GrowthComparisonChart.vue`.
  - It has a Skill / OR toggle, an age range, Hide / Show All, and the same squad-best
    grey line.
  - The component takes prebuilt series, so hockey's report could move to it too.
- History is thinned to one point per ~14 days by the shared
  `src/base/historyDownsample.ts`, which hockey re-exports.
- Neither chart has been seen in a browser yet.

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

## Backup format

Both stores in one JSON file (`src/types/Backup.ts`, `src/storage/backup.ts`):

```jsonc
{
  "format": "ppm-assistant-backup",  // absent -> rejected outright
  "version": 2,                      // 1 and 2 accepted; unknown -> rejected outright
  "exportedAt": "2026-08-30T…",
  "extensionVersion": "3.2.0",
  "playerCaches": { "ppm-assistant:hockey:team-12345": { /* PlayerCacheStorage */ } },
  "skillHistory": [ /* hockey's SkillHistoryEntry[] - the field every version has */ ],
  "sportSkillHistory": { "basketball": [ /* v2+: every other sport, by sport */ ] }
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
| Pace / projection / @25 math | **Verified.** 52 assertions in `test/growth-pace.check.ts`, plus replays of the Aug 28 backup: the catch-up player goes from 98% to 57%, every balanced player stays within 3 points of its rating-based pace, 14 of 15 players aged 25+ get a recorded @25 value, and the Octave backtest lands within 7% from age 20 onward. |
| Pace and @25 columns, projection line, `SKILL_HISTORY_LATEST_WINDOW`, `SKILL_HISTORY_NEAR_DATES` | **Never run in the browser.** The worker's key-then-get read has no test at all. |
| **Restore / import** | **NEVER RUN.** Not once, in any mode. |
| Clear All Data | **Never run.** |
| Squad-overview capture | **Never run in the browser.** |
| Auto-clearing notice, dialog focus trap | **Never run.** |

The 98 assertions live in [`test/`](../test/README.md), kept as-is because the *cases* were
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
`importCaches()`/`exportAllCaches()`, `growthPace.ts` and `squadRank.ts`, 98 assertions (five files, including basketball capture) — they just need a runner instead of the
throwaway vite-bundle-then-node dance the README describes. After that, the obvious next
targets are `downsampleHistory`, `mergeEntry`, `daysBetween`, `parseEntryKey`, `getLatestWindowEntries` and
`historyEntryAge`.

**5. Cross-sport - storage done, growth model not yet.** Every store is now keyed by sport, so
reused ids can't collide (see [Basketball](#basketball)). What's left is the growth model:
`growthPace.ts` still imports hockey's settings directly. Split it into a sport profile when
basketball's growth work starts (roadmap phase 4), shaped by what the research finds, not
guessed now.

For bugs rather than features, see [known-issues.md](known-issues.md).
