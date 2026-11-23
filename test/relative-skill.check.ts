/**
 * Assertions for relative skill: the shared fit (src/base/relativeSkillFit.ts),
 * the worker's league fit (src/storage/leagueReferenceFit.ts), the pure
 * player model, the display states (src/base/relativeSkill.ts) and the
 * history chart helpers (src/base/historyDownsample.ts) - see test/README.md.
 */

import {
  RelativeSkillFit,
  agesBetween,
  fitGlobalOr,
  fitLeagueOr,
  fitLeagueReference,
  referenceTable,
  scoutPoints,
  smoothSteps,
  smoothedSeasonGains,
  unimodal,
  withDerivedSeasons,
  xpCurve,
} from "@/base/relativeSkillFit";
import { relativePercent, relativeSkillView, relativeSortValue } from "@/base/relativeSkill";
import { LEAGUE_FIT_SETTINGS, createLeagueReferenceFitter } from "@/storage/leagueReferenceFit";
import { historyChartPoints, overallOrSkillSum } from "@/base/historyDownsample";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { LeagueTeams, ScoutSnapshot } from "@/types/ScoutSnapshot";

let failures = 0;

const check = async (name: string, fn: () => void | Promise<void>) => {
  try {
    await fn();
    console.log("PASS", name);
  } catch (e) {
    failures++;
    console.log("FAIL", name, "-", (e as Error).message);
  }
};

const eq = (a: unknown, b: unknown, m = "") => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
};
const ok = (condition: boolean, m: string) => {
  if (!condition) throw new Error(m);
};

let nextId = 0;
const snap = (age: number, overallRating: number, teamId = "t1", seasonDay = 56, season = 58): ScoutSnapshot =>
  ({
    id: `${nextId}`,
    playerId: `${nextId++}`,
    date: "2026-11-01",
    name: "x",
    teamId,
    age,
    overallRating,
    season,
    seasonDay,
  }) as ScoutSnapshot;

/** Thirty players per age 15-30, OR rising 100 a season, spread 0-290. */
const population = (teamId: string, scale = 1) =>
  agesBetween(15, 30).flatMap((age) =>
    Array.from({ length: 30 }, (_, i) => snap(age, Math.round((500 + (age - 15) * 100 + i * 10) * scale), teamId, 0))
  );

const fitOf = (or: number[]): RelativeSkillFit => ({
  percentile: 0.95,
  rows: or.map((value, i) => ({ age: 15 + i, or: value, share: 0.5, exp: 10 })),
});

(async () => {
  await check("one point per player and season: his latest snapshot", () => {
    const rows = [
      { ...snap(20, 1000), playerId: "p", date: "2026-10-01" },
      { ...snap(20, 1100), playerId: "p", date: "2026-11-01" },
      { ...snap(21, 1200), playerId: "p", date: "2026-12-01", season: 59 },
    ];
    eq(scoutPoints(rows, 112).map((p) => p.value).sort(), [1100, 1200]);
  });

  await check("unimodal: rises to a peak, then never rises again", () => {
    const fit = unimodal([1, 3, 2, 5, 4, 4.5, 2], [1, 1, 1, 1, 1, 1, 1]);
    const peak = fit.indexOf(Math.max(...fit));
    ok(fit.slice(0, peak + 1).every((v, i, a) => i === 0 || v >= a[i - 1]), `not rising: ${fit}`);
    ok(fit.slice(peak).every((v, i, a) => i === 0 || v <= a[i - 1]), `not falling: ${fit}`);
  });

  await check("global OR: the 95th percentile at each age, finite with sparse ages", () => {
    const ages = agesBetween(15, 40);
    const { curve } = fitGlobalOr(scoutPoints(population("t1"), 112), ages, 0.95);
    ok(curve.every(Number.isFinite) && curve.every((v) => v > 0), `bad curve ${curve}`);
    // Age 20: OR 1000-1290 -> p95 about 1276.
    ok(Math.abs(curve[5] - 1276) < 15, `age 20 at ${curve[5]}`);
  });

  await check("league: too few points gives no line", () => {
    const ages = agesBetween(15, 30);
    eq(fitLeagueOr(scoutPoints(population("t1").slice(0, 40), 112), ages, 0.95, ages.map(() => 1000)), null);
  });

  await check("league at 80% of the population reads 80% of the global line", () => {
    const ages = agesBetween(15, 30);
    const global = fitGlobalOr(scoutPoints(population("t1"), 112), ages, 0.95).curve;
    const league = fitLeagueOr(scoutPoints(population("t2", 0.8), 112), ages, 0.95, global)!;
    ok(league !== null, "no league line");
    ages.forEach((age, i) => ok(Math.abs(league.curve[i] / global[i] - 0.8) < 0.03, `age ${age}: ${league.curve[i] / global[i]}`));
  });

  await check("league: no team ids or no snapshots of them -> null", () => {
    const fit = fitOf(agesBetween(15, 30).map(() => 1000));
    eq(fitLeagueReference(fit, population("t1"), { season: 58, teamIds: [] }, 112).table, null);
    eq(fitLeagueReference(fit, population("t1"), { season: 58, teamIds: ["elsewhere"] }, 112), { table: null, points: 0, ages: 0 });
  });

  await check("league: only the list's season counts - last season's snapshots of the same teams don't", () => {
    const fit = fitOf(agesBetween(15, 30).map(() => 1500));
    const lastSeason = population("t1").map((row) => ({ ...row, season: 57 }));
    const result = fitLeagueReference(fit, lastSeason, { season: 58, teamIds: ["t1"] }, 112);
    eq([result.table, result.points], [null, 0]);
    ok(fitLeagueReference(fit, population("t1"), { season: 58, teamIds: ["t1"] }, 112).table !== null, "this season fits");
  });

  await check("XP curve: 0 at 15, 200 at 28, slower before 20, no kink at 20, slower after 28", () => {
    const xp = xpCurve(agesBetween(15, 45));
    eq(xp[0], 0, "15");
    ok(Math.abs(xp[13] - 200) < 1e-9, `28 at ${xp[13]}`);
    const gain = (i: number) => xp[i + 1] - xp[i];
    ok(gain(0) < gain(3) && gain(3) < gain(6), "junior gains rise");
    ok(Math.abs(gain(5) - gain(8)) < 1e-9, "constant 20-28");
    ok(Math.abs(xp[5] - xp[4] - 0.9 * gain(5)) < 1e-9, "the ramp reaches the full rate at 20");
    ok(Math.abs(gain(14) - 0.85 * gain(8)) < 1e-9, "0.85 after 28");
  });

  await check("step smoothing keeps one peak and the ends", () => {
    const smooth = smoothSteps([100, 200, 300, 300, 300, 250, 250, 200]);
    eq([smooth[0], smooth[7]], [100, 200]);
    const peak = smooth.indexOf(Math.max(...smooth));
    ok(smooth.slice(peak).every((v, i, a) => i === 0 || v <= a[i - 1]), `${smooth}`);
  });

  await check("the table: skill = share x OR", () => {
    eq(referenceTable(fitOf([1000, 1100]))[1], { age: 16, skill: 550, exp: 10 });
    eq(referenceTable(fitOf([1000, 1100]), [800, 900])[0], { age: 15, skill: 400, exp: 10 });
  });

  await check("display: no reference -> null, sorted last; global first, then league", () => {
    eq(relativePercent(500, 0), null);
    eq(relativePercent(500, null), null);
    eq(relativePercent(500, 1000), 50);
    eq(relativeSortValue(500, { global: null, league: 600 }), null);
    ok(relativeSortValue(500, { global: 1000, league: 600 })! > relativeSortValue(500, { global: 1000, league: 700 })!, "league tie-break");
    ok(relativeSortValue(500, { global: 900, league: 900 })! > relativeSortValue(500, { global: 1000, league: 500 })!, "global first");
  });

  const league = (season: number, teamIds = ["t1"]): LeagueTeams => ({
    season, leagueId: "lva-ii-4", leagueName: "II.4", teamIds, updatedAt: "",
  });
  /** Sources that count their reads. */
  const sources = (list: LeagueTeams | null, rows: ScoutSnapshot[], version = "1") => {
    const reads = { league: 0, version: 0, snapshots: 0 };
    return {
      reads,
      readLeague: async () => (reads.league++, list),
      snapshotVersion: async () => (reads.version++, version),
      readSnapshots: async () => (reads.snapshots++, rows),
    };
  };
  const settings = {
    ...LEAGUE_FIT_SETTINGS,
    hockey: { fit: fitOf(agesBetween(15, 30).map(() => 1500)), daysPerSeason: 112 },
  };

  await check("worker fit: no league list -> no-league, and the snapshots are never read", async () => {
    const fitter = createLeagueReferenceFitter(settings);
    const none = sources(null, population("t1"));
    eq(await fitter("hockey", 58, none), { table: null, status: { kind: "no-league" } });
    eq(none.reads, { league: 1, version: 0, snapshots: 0 });
    const empty = sources(league(58, []), population("t1"));
    eq((await fitter("hockey", 58, empty)).status, { kind: "no-league" });
    eq(empty.reads.snapshots, 0, "empty list");
  });

  await check("worker fit: a league list that can't be read -> error, not no-league", async () => {
    const fitter = createLeagueReferenceFitter(settings);
    const failing = sources(league(58), population("t1"));
    failing.readLeague = async () => {
      throw new Error("storage unavailable");
    };
    const quiet = console.error;
    console.error = () => {};
    try {
      eq(await fitter("hockey", 58, failing), { table: null, status: { kind: "error" } });
    } finally {
      console.error = quiet;
    }
    eq(failing.reads.snapshots, 0, "the snapshots are never read");
  });

  await check("worker fit: a list from an earlier season is stale, and the snapshots are never read", async () => {
    const fitter = createLeagueReferenceFitter(settings);
    const stale = sources(league(57), population("t1"));
    eq(await fitter("hockey", 58, stale), {
      table: null,
      status: { kind: "stale", listSeason: 57, currentSeason: 58 },
    });
    eq(stale.reads.snapshots, 0);
    // With the page's season unknown, the list is taken as current (and its
    // season's snapshots - none here, they are all season 58 - are used).
    eq((await fitter("hockey", null, sources(league(57), population("t1")))).status.kind, "sparse");
  });

  await check("worker fit: fitted once, cached per list and store version", async () => {
    const fitter = createLeagueReferenceFitter(settings);
    const first = sources(league(58), population("t1"));
    const fitted = await fitter("hockey", 58, first);
    eq(fitted.status, { kind: "fitted" });
    ok(fitted.table !== null && fitted.table.length === 16, "a table per age");
    const again = sources(league(58), population("t1"));
    eq((await fitter("hockey", 58, again)).table, fitted.table);
    eq(again.reads.snapshots, 0, "cached");
    const changed = sources(league(58), population("t1"), "2");
    await fitter("hockey", 58, changed);
    eq(changed.reads.snapshots, 1, "a new store version refits");
  });

  await check("worker fit: too few league points -> sparse, with the counts the tooltip names", async () => {
    const fitter = createLeagueReferenceFitter(settings);
    const status = (await fitter("hockey", 58, sources(league(58), population("t1").slice(0, 40)))).status;
    // 30 players at 15, 10 at 16: windows of up to ±1 season measure 15-17.
    eq(status, { kind: "sparse", points: 40, pointsNeeded: 50, ages: 3, agesNeeded: 3 });
  });

  await check("seasons: a snapshot without one gets it from its date; at a boundary it stays out", () => {
    // Season 58 started 2026-10-12 (day 1), seasons of 112 days.
    const anchor = { ...snap(20, 1000), date: "2026-11-01", season: 58, seasonDay: 21 };
    const noSeason = (date: string) => ({ ...snap(20, 1000), date, season: undefined, seasonDay: undefined });
    const { rows, derived, missing } = withDerivedSeasons(
      [anchor, noSeason("2026-10-20"), noSeason("2026-08-01"), noSeason("2026-10-12")],
      112
    );
    eq([rows[1].season, rows[1].seasonDay], [58, 9], "Oct 20");
    eq([rows[2].season, rows[2].seasonDay], [57, 41], "Aug 1");
    eq(rows[3].season, undefined, "day 1: within a day of the boundary");
    eq([derived, missing], [2, 1]);
  });

  await check("pure model: the league table is a parameter; no chrome is touched", () => {
    const touched: string[] = [];
    (globalThis as Record<string, unknown>).chrome = new Proxy({}, {
      get: (_, key) => {
        touched.push(String(key));
        return undefined;
      },
    });
    const player = new HockeyPlayer(
      { id: "1", name: "P", age: 28, careerLongitivity: 1, averageTrainingRatio: 80, overallRating: 2000 } as never,
      new Date(), "SCOUTED", true, 56,
      { goalie: 0, defence: 500, offence: 900, shooting: 700, passing: 450, technical: 450, aggression: 200 } as never
    );
    player.calculatePositions();
    const none = player.getRelativeSkillMaxima(null);
    ok(none.global! > 0, "global 100% at 28");
    eq(none.league, null);
    eq(player.getRelativeSkillMaxima(agesBetween(15, 45).map((age) => ({ age, skill: 1000, exp: 0 }))).league, 1000);
    const old = new HockeyPlayer({ ...player, id: "2", age: 47 } as never, new Date(), "SCOUTED", true, 56, player.skills as never);
    eq(old.getRelativeSkillMaxima(null), { global: null, league: null });
    const unscouted = new HockeyPlayer({ ...player, id: "3" } as never, new Date(), "UNSCOUTED", false, 56);
    eq(unscouted.getRelativeSkillMaxima(null), { global: null, league: null, skillsUnknown: true });
    eq(touched, [], "chrome accessed");
    delete (globalThis as Record<string, unknown>).chrome;
  });

  await check("display: 87% / 94%, 87% / ??? with the league's reason, ??? / ??? with the age's", () => {
    const fitted = relativeSkillView(870, { global: 1000, league: 925 }, 28, { kind: "fitted" });
    eq([fitted.global, fitted.league], [87, 94]);
    ok(fitted.title.includes("94% of a top-5% player in your league"), fitted.title);

    const sparse = relativeSkillView(870, { global: 1000, league: null }, 28, {
      kind: "sparse", points: 12, pointsNeeded: 50, ages: 2, agesNeeded: 3,
    });
    eq([sparse.global, sparse.league], [87, null]);
    ok(
      sparse.title.includes("League: not enough scouted players from your league this season (12 found, 50 needed)"),
      sparse.title
    );
    const stale = relativeSkillView(870, { global: 1000, league: null }, 28, { kind: "stale", listSeason: 57, currentSeason: 58 });
    ok(stale.title.includes("League: league list is from season 57; open your league page to refresh it"), stale.title);
    ok(relativeSkillView(870, { global: 1000, league: null }, 28, { kind: "no-league" }).title.includes("open your league page"), "no list");

    const noAge = relativeSkillView(870, { global: null, league: 900 }, 46, { kind: "fitted" });
    eq([noAge.global, noAge.league, noAge.title], [null, null, "No reference for age 46"]);
    const unscouted = relativeSkillView(0, { global: null, league: null, skillsUnknown: true }, 28, { kind: "fitted" });
    eq([unscouted.global, unscouted.league, unscouted.title], [null, null, "Unscouted player: skills unknown"]);

    // ??? sorts last in either direction: SortableTable puts a null last.
    eq(relativeSortValue(870, { global: null, league: null }), null);
    eq(relativeSortValue(870, { global: null, league: null, skillsUnknown: true }), null);
  });

  await check("history: OR, else the sum of a FULL set of skills; points read once, thinned after the filter", () => {
    const names = ["a", "b", "c"];
    eq(overallOrSkillSum(1500, { a: 1 }, names), 1500, "stored OR wins");
    eq(overallOrSkillSum(undefined, { a: 1.9, b: 2.9, c: 3.9 }, names), 6, "floored sum");
    eq(overallOrSkillSum(undefined, { a: 1, b: 2 }, names), null, "partial capture");
    eq(overallOrSkillSum(Number.NaN, undefined, names), null);
    const entries = [
      { date: "2026-01-01", v: 1 },
      { date: "2026-01-02", v: null },
      { date: "2026-03-01", v: 3 },
    ];
    eq(historyChartPoints(entries, (e) => e.v, (e) => Number(e.date.slice(5, 7))), [
      { x: 1, y: 1 },
      { x: 3, y: 3 },
    ]);
  });

  await check("smoothed growth rate: one peak, a steady decline, the line's steps gone", () => {
    // Gains 90, 121, 114, 97, 59, 33, 36, 35, 20, 13: a 33-point step at 26 between 59 and 36.
    const skills = [100, 190, 311, 425, 522, 581, 614, 650, 685, 705, 718];
    const gains = smoothedSeasonGains(skills.map((skill, i) => ({ age: 21 + i, skill })));
    const values = agesBetween(21, 30).map((age) => gains[age]);
    const peak = values.indexOf(Math.max(...values));
    ok(values.slice(0, peak + 1).every((v, i, a) => i === 0 || v >= a[i - 1]), `rises then: ${values}`);
    ok(values.slice(peak).every((v, i, a) => i === 0 || v <= a[i - 1]), `falls after the peak: ${values}`);
    ok(gains[26] > 33 && gains[26] < 59, `the step at 26 is evened out: ${gains[26]}`);
    eq(gains[21], 90, "the first age stays as fitted");
    eq(Object.keys(gains).length, skills.length - 1, "a gain per age but the last");
  });

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
})();
