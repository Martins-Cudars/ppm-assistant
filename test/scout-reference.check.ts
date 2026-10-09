/**
 * Assertions for the scouted roster data behind the Player Reports' League
 * and Elite lines, in every sport - see test/README.md:
 *
 * - base/scout/rosterParser.ts: a roster row (basketball's and hockey's
 *   layouts), the profile link, the league identity.
 * - base/scout/scoutCapture.ts: a row as today's snapshot.
 * - storage/scoutMerge.ts: same-day merge, and what a league page does to the
 *   stored league list.
 * - base/scout/scoutReference.ts: best OR per age, the league filter, and the
 *   report table's side: a group's best OR at an exact age, growth rates from
 *   players seen twice, the group's pace reference, a player's own OR rate,
 *   the squad's best OR at each age.
 */

import { parseSeasonText } from "@/base/captureUtils";
import {
  BASKETBALL_ROSTER,
  HOCKEY_ROSTER,
  SOCCER_ROSTER,
  parseLeagueIdentity,
  parseRosterRow as parseRow,
  profileHrefOf,
  teamIdFromHref,
} from "@/base/scout/rosterParser";
import { buildScoutSnapshot } from "@/base/scout/scoutCapture";
import {
  RATE_MIN_PAIRS,
  bestOrAt,
  bestOrByAge as bestOrByAgeIn,
  buildScoutReferences as buildReferencesIn,
  groupRateByAge,
  isLeagueStale,
  leagueSnapshots,
  ownOrRate,
  scoutCoverage,
  scoutRatePairs as ratePairsIn,
  scoutedPairCount,
  snapshotExactAge,
  squadBestOrByAge,
  squadHistoryOnly,
} from "@/base/scout/scoutReference";
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

// Most cases are basketball's, as first written: its 70-day season and layout.
const BASKETBALL_DAYS = 70;
const HOCKEY_DAYS = 112;
const parseRosterRow = (cells: string[], href: string | undefined) => parseRow(cells, href, BASKETBALL_ROSTER);
const bestOrByAge = (snapshots: ScoutSnapshot[]) => bestOrByAgeIn(snapshots, BASKETBALL_DAYS);
const buildScoutReferences = (snapshots: ScoutSnapshot[], league: LeagueTeams | null) =>
  buildReferencesIn(snapshots, league, BASKETBALL_DAYS);
const scoutRatePairs = (snapshots: ScoutSnapshot[]) => ratePairsIn(snapshots, BASKETBALL_DAYS);

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

check("hockey's roster row: 10 columns, no height; the profile link among the name cell's links", () => {
  // The live row (2026-10-04): # Name Fun ScP Age AvQ CL Con Pop OR
  const hockey = ["0", "Trisztán Elekes", "", "", "35", "24", "0/6", "48", "1", "689"];
  const link = profileHrefOf([
    "/en/country-profile.html?data=hun",
    null,
    "/en/player.html?data=12345678-trisztan-elekes",
  ]);
  eq(link, "/en/player.html?data=12345678-trisztan-elekes");
  eq(parseRow(hockey, link, HOCKEY_ROSTER), {
    playerId: "12345678",
    name: "Trisztán Elekes",
    age: 35,
    height: undefined,
    averageQuality: 24,
    careerLongevity: 0,
    overallRating: 689,
  });
  eq(parseRow(hockey, link, BASKETBALL_ROSTER), null, "basketball's layout rejects a hockey row");
  eq(parseRow(cells, href, HOCKEY_ROSTER), null, "and the other way round");
  eq(profileHrefOf(["/en/country-profile.html?data=lva"]), undefined, "a flag alone is no player");
});

check("soccer's roster row: hockey's layout, 10 columns", () => {
  // The live row (2026-10-04): # Name Fun ScP Age AvQ CL Con Popularity OR
  const soccer = ["0", "Hermanni Leppänen", "", "", "39", "41", "0/6", "84", "", "9"];
  eq(parseRow(soccer, "/en/player.html?data=30057496-hermanni-leppanen", SOCCER_ROSTER), {
    playerId: "30057496",
    name: "Hermanni Leppänen",
    age: 39,
    height: undefined,
    averageQuality: 41,
    careerLongevity: 0,
    overallRating: 9,
  });
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

check("best OR per age, at the best snapshot's exact age, naming the player", () => {
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

check("a new season's youngest have a point of their own, before last season's late one", () => {
  // Scouted on day 68 of 70, then again on day 5 of the next season: last
  // season's 15-year-old (now 16) is the best "at 15", but he was nearly 16.
  const points = bestOrByAge([
    snap("1", 15, 530, { name: "Old", seasonDay: 68 }),
    snap("1", 16, 540, { id: "1:2026-10-09", date: "2026-10-09", name: "Old", seasonDay: 5, season: 65 }),
    snap("2", 15, 372, { id: "2:2026-10-09", date: "2026-10-09", name: "New", seasonDay: 5, season: 65 }),
  ]);
  eq(points.map((p) => p.y), [372, 530, 540]);
  near(points[0].x, 15 + 5 / 70, 1e-9);
  near(points[1].x, 15 + 68 / 70, 1e-9);
  eq(bestOrAt(points, 15 + 5 / 70)?.value, 372, "a 15-year-old on day 5 has someone to compare with");
  eq(bestOrAt(points, 15 + 5 / 70)?.note, "New");
});

check("parts of a season: a later, lower part of the same age is dropped; the last day stays in its age", () => {
  // Day 40 saw one team only - its best is no measure of the group.
  const dip = bestOrByAge([
    snap("1", 19, 500, { seasonDay: 5 }),
    snap("2", 19, 420, { seasonDay: 40 }),
    snap("3", 19, 560, { seasonDay: 60 }),
  ]);
  eq(dip.map((p) => p.y), [500, 560]);

  const lastDay = bestOrByAge([snap("1", 19, 500, { seasonDay: 70 }), snap("2", 20, 450, { seasonDay: 0 })]);
  eq(lastDay.map((p) => [p.x, p.y]), [[20, 500], [20, 450]], "19 on day 70 is still 19's point");
  eq(bestOrByAge([{ ...snap("1", 19, 500), seasonDay: undefined }]).map((p) => p.x), [19], "no day read");
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

// The sport's own age curve: 1.0 to 24, half from 25. Any unit - only its shape counts.
const shape = (age: number) => (age < 25 ? 1 : 0.5);
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

check("hockey: exact ages on a 112-day season, and its own curve filling the gaps", () => {
  near(snapshotExactAge(snap("1", 20, 500, { seasonDay: 56 }), HOCKEY_DAYS)!, 20.5, 1e-9);
  near(snapshotExactAge(snap("1", 20, 500, { seasonDay: 56 }), BASKETBALL_DAYS)!, 20.8, 1e-9);
  const points = bestOrByAgeIn([snap("1", 20, 500, { seasonDay: 28 })], HOCKEY_DAYS);
  near(points[0].x, 20.25, 1e-9);

  // 85 days within one 112-day season, day 10 to day 95 at 22: the middle is 22.47.
  // (On a 70-day season the same dates couldn't both be age 22.)
  const rates = ratePairsIn(
    [
      seen("1", "2026-10-02", 22, 10, 900),
      seen("1", "2026-12-26", 22, 95, 985),
      // Across a birthday: day 100 at 22 to day 73 at 23 - the middle is 23.27.
      seen("2", "2026-10-02", 22, 100, 900, { teamId: "5" }),
      seen("2", "2026-12-26", 23, 73, 900 + 85 * 0.5, { teamId: "5" }),
    ],
    HOCKEY_DAYS
  );
  eq(rates.map((r) => r.age), [22, 23]);
  near(rates[0].perDay, 1, 1e-9);

  // Hockey's own curve as the shape: measured 22 and 23 scale the rest from the nearest.
  const hockeyShape = (age: number) => (age <= 22 ? 60 : age <= 26 ? 40 : 10);
  const curve = groupRateByAge(rates, hockeyShape);
  near(curve.find((p) => p.age === 22)!.perDay, 1, 1e-9);
  near(curve.find((p) => p.age === 23)!.perDay, 0.5, 1e-9);
  near(curve.find((p) => p.age === 18)!.perDay, 1, 1e-9, "from 22, same shape value");
  near(curve.find((p) => p.age === 25)!.perDay, 0.5, 1e-9, "from 23, same shape value");
  near(curve.find((p) => p.age === 30)!.perDay, 0.5 * (10 / 40), 1e-9, "from 23, scaled by the shape");
});

check("the squad's best OR at each age: the nearest day to each birthday, the best player", () => {
  const today = Date.parse("2026-10-04T00:00:00");
  const day = (daysAgo: number) => new Date(today - daysAgo * 86_400_000).toISOString().slice(0, 10);
  // Player A is 22.0 today on a 112-day season; B is 21.5.
  const history = new Map([
    ["A", [{ date: day(0), or: 900 }, { date: day(112), or: 800 }, { date: day(50), or: 870 }]],
    ["B", [{ date: day(56), or: 850 }, { date: day(58), or: 840 }, { date: day(168), or: 700 }]],
  ]);
  const points = squadBestOrByAge(
    history,
    new Map([["A", 22], ["B", 21.5]]),
    HOCKEY_DAYS,
    (entry) => entry.or,
    new Map([["A", "Alpha"], ["B", "Beta"]]),
    today
  );
  // At 21: A had 800, B 850 (56 days ago, exactly on his birthday) -> B.
  // At 22: A's 900. At 20: B's 700. A's day 50 ago is mid-age, not a birthday.
  eq(points, [
    { x: 20, y: 700, note: "Beta" },
    { x: 21, y: 850, note: "Beta" },
    { x: 22, y: 900, note: "Alpha" },
  ]);
  eq(squadBestOrByAge(new Map(), new Map(), HOCKEY_DAYS, () => 1), [], "no history");
});

check("the squad's line leaves out opponents only ever opened on their profile", () => {
  const history = new Map([
    ["own", [{ source: "PlayersList" }, { source: "PlayerProfile" }]],
    ["trained", [{ source: "TrainingProgress" }]],
    ["legacy", [{ source: undefined }]],
    ["opponent", [{ source: "PlayerProfile" }, { source: "PlayerProfile" }]],
  ]);
  eq([...squadHistoryOnly(history).keys()], ["own", "trained", "legacy"]);

  // An opponent with a high OR on his birthday doesn't set the line.
  const today = Date.parse("2026-10-04T00:00:00");
  const ownDay = { date: "2026-10-04", or: 700, source: "PlayersList" };
  const rival = { date: "2026-10-04", or: 999, source: "PlayerProfile" };
  const points = squadBestOrByAge(
    squadHistoryOnly(new Map([["own", [ownDay]], ["rival", [rival]]])),
    new Map([["own", 22], ["rival", 22]]),
    HOCKEY_DAYS,
    (entry) => entry.or,
    new Map(),
    today
  );
  eq(points.map((p) => p.y), [700]);
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
