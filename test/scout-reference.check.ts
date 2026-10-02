/**
 * Assertions for the scouted roster data behind the basketball report's ELITE
 * and LEAGUE lines - see test/README.md:
 *
 * - sports/basketball/parsers/teamRoster.ts: a roster row, the league identity.
 * - sports/basketball/scoutCapture.ts: a row as today's snapshot.
 * - storage/scoutMerge.ts: same-day merge, and what a league page does to the
 *   stored league list.
 * - sports/basketball/scoutReference.ts: best OR per age, the league filter,
 *   and the report table's side: a group's best OR at an exact age, growth
 *   rates from players seen twice, the group's pace reference, a player's own
 *   OR rate.
 */

import { parseSeasonText } from "@/base/captureUtils";
import {
  parseLeagueIdentity,
  parseRosterRow,
  teamIdFromHref,
} from "@/sports/basketball/parsers/teamRoster";
import { buildScoutSnapshot } from "@/sports/basketball/scoutCapture";
import { ReferenceCurve } from "@/sports/basketball/growthModel";
import {
  RATE_MIN_PAIRS,
  bestOrAt,
  bestOrByAge,
  buildScoutReferences,
  groupRateByAge,
  isLeagueStale,
  leagueSnapshots,
  ownOrRate,
  scoutCoverage,
  scoutRatePairs,
  scoutedPairCount,
} from "@/sports/basketball/scoutReference";
import { mergeScoutSnapshot, nextLeagueTeams } from "@/storage/scoutMerge";
import { LeagueTeams, ScoutSnapshot } from "@/types/ScoutSnapshot";

let failures = 0;
const check = (name: string, fn: () => void) => {
  try {
    fn();
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
const near = (a: number, b: number, tol: number, m = "") => {
  if (Math.abs(a - b) > tol) throw new Error(`${m} expected ~${b}, got ${a}`);
};

// --- Parsing ----------------------------------------------------------------------

// The live row (2026-10-02): # Name Fun ScP Age Hgt AvQ CL Con Popularity OR
const cells = ["0", " Valters Pavītols ", "", "", "19", "186", "26", "5/6", "22", " 1 ", "487"];
const href = "/en/player-profile.html?data=3090982-valters-pavitols";

check("a roster row: id from the profile link, the columns by position", () => {
  eq(parseRosterRow(cells, href), {
    playerId: "3090982",
    name: "Valters Pavītols",
    age: 19,
    height: 186,
    averageQuality: 26,
    careerLongevity: 5,
    overallRating: 487,
  });
});

check("a roster row: thousands separators in the OR, either language's", () => {
  eq(parseRosterRow([...cells.slice(0, 10), "1,024"], href)?.overallRating, 1024, "English comma");
  eq(parseRosterRow([...cells.slice(0, 10), "1 024"], href)?.overallRating, 1024, "space");
});

check("a roster row: rejected without a player, an age or an OR, or from another layout", () => {
  eq(parseRosterRow(cells, "/en/country-profile.html?data=lva"), null, "the flag link is no player");
  eq(parseRosterRow(cells, undefined), null, "no link");
  eq(parseRosterRow([...cells.slice(0, 4), "", ...cells.slice(5)], href), null, "no age");
  eq(parseRosterRow([...cells.slice(0, 10), "-"], href), null, "no OR");
  eq(parseRosterRow(cells.slice(0, 9), href), null, "a table with other columns");
  eq(parseRosterRow([...cells.slice(0, 7), "", ...cells.slice(8)], href)?.careerLongevity, undefined, "CL unread, row kept");
});

check("season text, team ids and the league identity", () => {
  eq(parseSeasonText("Skanste Sentinels III.3 Season: 64 (68/70)"), { season: 64, seasonDay: 68 });
  eq(parseSeasonText("Skanste Sentinels III.3 Sezona: 64 (68/70)"), { season: 64, seasonDay: 68 });
  eq(parseSeasonText("no season here"), null);
  eq(teamIdFromHref("https://x/en/team.html?data=42029-jelgava-slashing"), "42029");
  eq(teamIdFromHref("?data=42029"), "42029");
  eq(teamIdFromHref("/en/league.html?data=b-lva-iii-3-64-d"), null, "a league link is no team");
  eq(
    parseLeagueIdentity({ season: "64", country: "lva", countryName: "Latvia", level: "iii", number: "3" }),
    { season: 64, leagueId: "lva-iii-3", leagueName: "III.3 (Latvia)" }
  );
  eq(parseLeagueIdentity({ season: "64", country: "lva", level: "iii" }), null, "a selector missing");
});

// --- Snapshots --------------------------------------------------------------------

const snap = (
  playerId: string,
  age: number,
  overallRating: number,
  extra: Partial<ScoutSnapshot> = {}
): ScoutSnapshot => ({
  id: `${playerId}:2026-10-02`,
  playerId,
  date: "2026-10-02",
  age,
  overallRating,
  teamId: "1",
  seasonDay: 35,
  season: 64,
  capturedAt: "t",
  source: "TeamRoster",
  ...extra,
});

check("a row becomes today's snapshot with its team and season", () => {
  const snapshot = buildScoutSnapshot(
    parseRosterRow(cells, href)!,
    { teamId: "42029", teamName: "Jelgava Slashing", season: 64, seasonDay: 68, source: "TeamRoster" },
    "2026-10-02"
  );
  eq(
    { ...snapshot, capturedAt: "t" },
    {
      id: "3090982:2026-10-02",
      playerId: "3090982",
      date: "2026-10-02",
      name: "Valters Pavītols",
      teamId: "42029",
      age: 19,
      overallRating: 487,
      capturedAt: "t",
      source: "TeamRoster",
      teamName: "Jelgava Slashing",
      season: 64,
      seasonDay: 68,
      height: 186,
      averageQuality: 26,
      careerLongevity: 5,
    }
  );
});

check("same-day merge: incoming wins where present, stored survives where it's silent", () => {
  const stored = snap("7", 19, 480, { height: 186, careerLongevity: 5 });
  const merged = mergeScoutSnapshot(stored, snap("7", 19, 487, { height: undefined, careerLongevity: undefined }));
  eq(merged.overallRating, 487);
  eq(merged.height, 186, "an unread height doesn't erase the stored one");
  eq(merged.careerLongevity, 5);
  eq(mergeScoutSnapshot(undefined, stored), stored, "a first capture is taken as is");
});

// --- The lines --------------------------------------------------------------------

check("best OR per whole age, at the best snapshot's exact age, naming the player", () => {
  const points = bestOrByAge([
    snap("1", 19, 400, { name: "A", teamName: "Reds" }),
    snap("2", 19, 520, { name: "B", teamName: "Blues", seasonDay: 14 }),
    snap("3", 21, 700, { name: "C" }),
    snap("4", 20, 610),
  ]);
  eq(points.map((p) => p.y), [520, 610, 700], "ascending by age, the best of each");
  near(points[0].x, 19.2, 1e-9, "19 + 14/70");
  near(points[1].x, 20.5, 1e-9, "20 + 35/70");
  eq(points[0].note, "B, Blues");
  eq(points[1].note, undefined, "no name stored");
});

check("a player seen at two ages counts at both; rows without age or OR are skipped", () => {
  const points = bestOrByAge([
    snap("1", 19, 500),
    snap("1", 20, 600, { id: "1:2027-01-10", date: "2027-01-10" }),
    snap("2", 20, 590),
    { ...snap("3", 22, 900), age: undefined },
    { ...snap("4", 22, 900), overallRating: undefined },
  ]);
  eq(points.map((p) => [Math.floor(p.x), p.y]), [[19, 500], [20, 600]]);
  eq(bestOrByAge([]), [], "nothing scouted");
});

const league: LeagueTeams = {
  season: 64,
  leagueId: "lva-iii-3",
  leagueName: "III.3 (Latvia)",
  teamIds: ["1", "2"],
  updatedAt: "2026-10-02T00:00:00.000Z",
};

check("LEAGUE keeps only players seen on a league team; a mover counts where he was seen", () => {
  const snapshots = [
    snap("1", 19, 500, { teamId: "1" }),
    snap("2", 19, 900, { teamId: "9" }), // elite, not in the league
    // Player 3 was on league team 2 at 20, then moved to team 9.
    snap("3", 20, 600, { teamId: "2" }),
    snap("3", 21, 650, { id: "3:2027-01-10", date: "2027-01-10", teamId: "9" }),
    { ...snap("4", 22, 700), teamId: undefined },
  ];
  eq(leagueSnapshots(snapshots, league).map((s) => s.id), ["1:2026-10-02", "3:2026-10-02"]);
  eq(leagueSnapshots(snapshots, null), [], "no league saved");

  const references = buildScoutReferences(snapshots, league);
  eq(references.elite.points.map((p) => p.y), [900, 600, 650, 700]);
  eq(references.league.points.map((p) => p.y), [500, 600]);
  eq(scoutCoverage(snapshots), { players: 4, teams: 3 });
  if (!references.league.caption.includes("2 players from 2 of 2 teams")) {
    throw new Error(`league caption: ${references.league.caption}`);
  }
});

check("captions say what to do when there is no data or the league list is old", () => {
  const empty = buildScoutReferences([], null);
  eq(empty.elite.points, []);
  if (!/nothing scouted yet/.test(empty.elite.caption)) throw new Error(empty.elite.caption);
  if (!/open your league standings/.test(empty.league.caption)) throw new Error(empty.league.caption);

  const nextSeason = [snap("1", 20, 500, { season: 65 })];
  eq(isLeagueStale(league, nextSeason), true);
  eq(isLeagueStale(league, [snap("1", 20, 500)]), false);
  eq(isLeagueStale(null, nextSeason), false);
  if (!/earlier season/.test(buildScoutReferences(nextSeason, league).league.caption)) {
    throw new Error("stale league not mentioned");
  }
});

// --- The league list --------------------------------------------------------------

const page = (teamIds: string[], extra: Partial<Parameters<typeof nextLeagueTeams>[1]> = {}) => ({
  season: 64,
  leagueId: "lva-iii-3",
  leagueName: "III.3 (Latvia)",
  teamIds,
  isDefaultPage: false,
  ...extra,
});

check("league list: the default page starts it, the full table adds to it, the user is always in", () => {
  // Late season the default page is the relegation round - half the league, no user.
  const first = nextLeagueTeams(null, page(["11", "12"], { isDefaultPage: true }), "39743", 64, "t1");
  eq(first?.teamIds, ["11", "12", "39743"]);
  // "League standings" has a data param and lists everyone, the user included.
  const full = nextLeagueTeams(first!, page(["11", "12", "13", "39743"]), "39743", 64, "t2");
  eq(full?.teamIds, ["11", "12", "39743", "13"]);
  eq(full?.updatedAt, "t2");
});

check("league list: another league changes nothing; a new season or league replaces it", () => {
  const stored = nextLeagueTeams(null, page(["11", "39743"]), "39743", 64, "t1")!;
  eq(nextLeagueTeams(stored, page(["21", "22"], { leagueId: "svk-i-1" }), "39743", 64), null, "browsing another league");
  eq(nextLeagueTeams(null, page(["21", "22"]), "39743", 64), null, "not the user's, nothing stored");
  eq(nextLeagueTeams(stored, page([], { isDefaultPage: true }), "39743", 64), null, "an empty table");

  // Promoted: next season the default page shows a different league.
  const promoted = nextLeagueTeams(
    stored,
    page(["31", "32"], { season: 65, leagueId: "lva-ii-1", leagueName: "II.1 (Latvia)", isDefaultPage: true }),
    "39743",
    65,
    "t3"
  );
  eq(promoted?.teamIds, ["31", "32", "39743"], "the old league's teams are gone");
  eq(promoted?.leagueName, "II.1 (Latvia)");
  eq(promoted?.season, 65);
});

check("league list: a past season's table changes nothing, even with the user in it", () => {
  const stored = nextLeagueTeams(null, page(["11", "39743"]), "39743", 64, "t1")!;
  // Season 63's standings: the user's team is listed, in a league since left.
  const past = page(["51", "52", "39743"], { season: 63, leagueId: "lva-iv-2" });
  eq(nextLeagueTeams(stored, past, "39743", 64), null, "browsing last season");
  eq(nextLeagueTeams(null, { ...past, isDefaultPage: true }, "39743", 64), null, "nothing stored either");
  // Without a readable header season the page is judged as before.
  eq(nextLeagueTeams(null, page(["11", "39743"]), "39743", null)?.teamIds, ["11", "39743"]);
});

// --- The table: level and pace against a group -------------------------------------

check("best OR at an exact age: between points, just past the ends, null beyond", () => {
  const line = [
    { x: 19, y: 500, note: "A" },
    { x: 20, y: 600, note: "B" },
    { x: 22, y: 700, note: "C" },
  ];
  eq(bestOrAt(line, 19.25), { value: 525, note: "A" }, "a quarter of the way");
  eq(bestOrAt(line, 21.5), { value: 675, note: "C" }, "across a missing age");
  eq(bestOrAt(line, 20), { value: 600, note: "B" }, "on a point");
  eq(bestOrAt(line, 18.6), { value: 500, note: "A" }, "just before the first");
  eq(bestOrAt(line, 22.5), { value: 700, note: "C" }, "just past the last");
  eq(bestOrAt(line, 18.4), null, "nobody that young");
  eq(bestOrAt(line, 23), null, "nobody that old");
  eq(bestOrAt([], 20), null, "no line");
});

const seen = (
  playerId: string,
  date: string,
  age: number,
  seasonDay: number,
  overallRating: number,
  extra: Partial<ScoutSnapshot> = {}
): ScoutSnapshot => ({
  ...snap(playerId, age, overallRating, extra),
  id: `${playerId}:${date}`,
  date,
  seasonDay,
});

check("a rate needs the same player twice, 42-105 days apart, on the same team", () => {
  const rates = scoutRatePairs([
    // 56 days, +70 OR: 1.25 a day. Day 60 of age 19 to day 46 of age 20.
    seen("1", "2026-10-02", 19, 60, 500, { name: "A" }),
    seen("1", "2026-11-27", 20, 46, 570, { name: "A" }),
    // Only 28 days apart.
    seen("2", "2026-10-02", 21, 60, 600),
    seen("2", "2026-10-30", 21, 18, 640),
    // Transferred in between.
    seen("3", "2026-10-02", 22, 60, 700),
    seen("3", "2026-11-27", 23, 46, 760, { teamId: "9" }),
    // Seen once.
    seen("4", "2026-10-02", 24, 60, 800),
    // Three visits: the latest against the earliest within range (not the 150-day-old one).
    seen("5", "2026-06-30", 25, 30, 800),
    seen("5", "2026-10-02", 26, 54, 900),
    seen("5", "2026-11-27", 27, 40, 928),
  ]);
  eq(rates.map((r) => r.playerId), ["1", "5"]);
  near(rates[0].perDay, 1.25, 1e-9);
  eq(rates[0].days, 56);
  eq(rates[0].age, 20, "the middle of 19.86 and 20.66");
  near(rates[1].perDay, 0.5, 1e-9, "28 OR over 56 days");
});

check("the ready rule counts other teams' players only - the own squad can't make a group ready", () => {
  // 20 own players seen on two overview visits, plus 3 scouted players.
  const snapshots = [
    ...Array.from({ length: 20 }, (_, i) => [
      seen(`own${i}`, "2026-10-02", 20, 60, 500, { teamId: "39743", source: "PlayersList" }),
      seen(`own${i}`, "2026-11-27", 21, 46, 550, { teamId: "39743", source: "PlayersList" }),
    ]).flat(),
    ...Array.from({ length: 3 }, (_, i) => [
      seen(`far${i}`, "2026-10-02", 20, 60, 700, { teamId: "7" }),
      seen(`far${i}`, "2026-11-27", 21, 46, 770, { teamId: "7" }),
    ]).flat(),
  ];
  const rates = scoutRatePairs(snapshots);
  eq(rates.length, 23, "everyone has a pair");
  eq(scoutedPairCount(rates, "39743"), 3, "only the scouted ones count");
  eq(scoutedPairCount(rates, "39743") >= RATE_MIN_PAIRS, false, "not ready");
  eq(scoutedPairCount(rates, undefined), 23, "own team unknown: nothing to leave out");
});

const shape: ReferenceCurve = Array.from({ length: 20 }, (_, i) => ({
  age: 15 + i,
  perDay: 15 + i < 25 ? 1 : 0.5,
  source: "default" as const,
}));
const rate = (playerId: string, age: number, perDay: number) => ({ playerId, age, perDay, days: 56 });

check("a group's 100% is the mean of the top 3, never rising after the peak, gaps filled by shape", () => {
  const curve = groupRateByAge(
    [
      rate("a", 20, 1.5), rate("b", 20, 1.2), rate("c", 20, 0.9), rate("d", 20, 0.1),
      rate("e", 21, 0.8),
      rate("f", 22, 1.0), rate("g", 22, 1.0), // a rise after the peak: pooled with 21
      rate("h", 40, 9), // outside the curve's ages
    ],
    shape
  );
  const at = (age: number) => curve.find((p) => p.age === age)!;
  near(at(20).perDay, 1.2, 1e-9, "(1.5 + 1.2 + 0.9) / 3, the fourth left out");
  eq(at(20).top.map((r) => r.playerId), ["a", "b", "c"]);
  near(at(21).perDay, 0.9, 1e-9, "21 and 22 averaged");
  near(at(22).perDay, 0.9, 1e-9);
  eq(at(21).source, "measured");
  // 19 has no pairs: the shape (1.0 at both) scaled to meet 20.
  near(at(19).perDay, 1.2, 1e-9);
  eq(at(19).source, "filled");
  // 26: the shape halves from 25 on, scaled from 22's 0.9.
  near(at(26).perDay, 0.45, 1e-9);
  eq(curve.length, 20, "15 to 34");
  eq(groupRateByAge([], shape), [], "no pairs, no curve");
  eq(RATE_MIN_PAIRS, 10);
});

check("a player's own OR rate: calendar days over his last 56, null under 28", () => {
  const days = (count: number, perDay: number) =>
    Array.from({ length: count }, (_, i) => ({
      date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      or: Math.floor(500 + i * perDay),
    }));
  const own = ownOrRate(days(100, 1))!;
  eq(own.days, 56);
  near(own.perDay, 1, 1e-9);
  eq(own.fromDate, "2026-02-13");
  eq(own.toDate, "2026-04-10");
  eq(ownOrRate(days(20, 1)), null, "19 days of span");
  eq(ownOrRate([]), null);
  // Like for like with a scouted pair: 0.7 a day read as 39 OR over 56 days.
  near(ownOrRate(days(57, 0.7))!.perDay, 39 / 56, 1e-9);
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
