/**
 * Assertions for squadRank.ts - see test/README.md for how to run these.
 *
 * The case most worth keeping: the subject's own cached copy is dropped. The
 * cache holds every own player, the profile being viewed included, and ranking
 * the live player against their days-old self would count them twice.
 */

import { RankedPlayer, ordinal, rankInSquad } from "@/sports/hockey/squadRank";

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
  if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

const w = (id: string, rating: number): RankedPlayer => ({
  id,
  name: `Winger ${id}`,
  position: "W",
  rating,
});

const squad = [w("a", 900), w("b", 850), w("c", 800), w("d", 700), w("e", 600)];

/** The slice as "rank:id:side" strings, for compact comparison. */
const slice = (r: ReturnType<typeof rankInSquad>) =>
  r.rows.map((row) => `${row.rank}:${row.id}:${row.side}`).join(" ");

check("ranks among players at the same position", () => {
  const r = rankInSquad(w("x", 750), squad);
  eq(r.rank, 4, "rank");
  eq(r.total, 6, "of");
});

check("shows two above and two below, the subject in the middle", () => {
  const r = rankInSquad(w("x", 750), squad);
  eq(slice(r), "2:b:above 3:c:above 4:x:subject 5:d:below 6:e:below");
  eq(r.rows.map((row) => row.gap).join(","), "100,50,0,-50,-150", "gaps");
});

check("at the top the slice shifts down", () => {
  const r = rankInSquad(w("x", 1000), squad);
  eq(r.rank, 1);
  eq(slice(r), "1:x:subject 2:a:below 3:b:below 4:c:below 5:d:below");
});

check("at the bottom the slice shifts up", () => {
  const r = rankInSquad(w("x", 100), squad);
  eq(r.rank, 6);
  eq(slice(r), "2:b:above 3:c:above 4:d:above 5:e:above 6:x:subject");
});

check("one from the top keeps four neighbours", () => {
  const r = rankInSquad(w("x", 875), squad);
  eq(slice(r), "1:a:above 2:x:subject 3:b:below 4:c:below 5:d:below");
});

check("a small pool shows everyone", () => {
  const r = rankInSquad(w("x", 750), [w("a", 900), w("b", 600)]);
  eq(slice(r), "1:a:above 2:x:subject 3:b:below");
});

check("the neighbour count is adjustable", () => {
  const r = rankInSquad(w("x", 750), squad, 2);
  eq(slice(r), "3:c:above 4:x:subject 5:d:below");
});

check("other positions don't count", () => {
  const mixed = [...squad, { id: "g", name: "Goalie", position: "G", rating: 2000 }];
  eq(rankInSquad(w("x", 750), mixed).total, 6);
});

check("the subject's cached copy is ignored", () => {
  // "c" viewed live at 820: its cached 800 must not rank against it.
  const r = rankInSquad(w("c", 820), squad);
  eq(r.total, 5, "counted once");
  eq(r.rank, 3, "ranked on the live rating");
  eq(r.rows.filter((row) => row.id === "c").length, 1, "one row for the subject");
});

check("an outsider ranks the same as a member would", () => {
  // Membership only changes the wording ("is" / "would be"), not the maths.
  const outsider = rankInSquad(w("new", 875), squad);
  eq(outsider.rank, 2);
  eq(outsider.total, 6);
});

check("ties share the better rank, subject listed first", () => {
  const r = rankInSquad(w("x", 800), squad);
  eq(r.rank, 3, "ties with c at 800");
  eq(slice(r), "1:a:above 2:b:above 3:x:subject 3:c:below 5:d:below");
});

check("the only player at the position", () => {
  const r = rankInSquad({ id: "x", name: "Goalie", position: "G", rating: 500 }, squad);
  eq(r.rank, 1);
  eq(r.total, 1);
  eq(slice(r), "1:x:subject");
});

check("ordinals", () => {
  eq([1, 2, 3, 4].map(ordinal).join(" "), "1st 2nd 3rd 4th", "1-4");
  eq([11, 12, 13].map(ordinal).join(" "), "11th 12th 13th", "teens");
  eq([21, 22, 23].map(ordinal).join(" "), "21st 22nd 23rd", "twenties");
  eq(ordinal(111), "111th", "hundreds");
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
