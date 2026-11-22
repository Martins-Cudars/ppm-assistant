/**
 * Assertions for relative skill: the shared fit (src/base/relativeSkillFit.ts),
 * the runtime league line (src/base/scout/leagueRelativeSkill.ts) and the
 * display helpers (src/base/relativeSkill.ts) - see test/README.md.
 */

import {
  RelativeSkillFit,
  agesBetween,
  fitGlobalOr,
  fitLeagueOr,
  referenceTable,
  scoutPoints,
  unimodal,
} from "@/base/relativeSkillFit";
import { relativePercent, relativeSortValue } from "@/base/relativeSkill";
import {
  fitLeagueReference,
  leagueReference,
  setLeagueReference,
  whenLeagueReference,
} from "@/base/scout/leagueRelativeSkill";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { ScoutSnapshot } from "@/types/ScoutSnapshot";

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
    eq(fitLeagueReference(fit, population("t1"), [], 112), null);
    eq(fitLeagueReference(fit, population("t1"), ["elsewhere"], 112), null);
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

  await check("player: outside the extension there is no league; set, it is read", async () => {
    const player = new HockeyPlayer(
      { id: "1", name: "P", age: 28, careerLongitivity: 1, averageTrainingRatio: 80, overallRating: 2000 } as never,
      new Date(), "SCOUTED", true, 56
    );
    eq(leagueReference("hockey", fitOf([]), 112), null);
    eq(await whenLeagueReference("hockey", fitOf([]), 112), null);
    ok(player.getRelativeSkillMaxima().global! > 0, "global 100% at 28");
    eq(player.getRelativeSkillMaxima().league, null);
    setLeagueReference("hockey", agesBetween(15, 45).map((age) => ({ age, skill: 1000, exp: 0 })));
    eq(player.getRelativeSkillMaxima().league, 1000);
    const old = new HockeyPlayer({ ...player, id: "2", age: 47 } as never, new Date(), "SCOUTED", true, 56);
    eq(old.getRelativeSkillMaxima(), { global: null, league: null });
  });

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
})();
