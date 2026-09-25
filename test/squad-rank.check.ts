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

check("ranks among players at the same position", () => {
  const r = rankInSquad(w("x", 750), squad);
  eq(r.rank, 4, "rank");
  eq(r.total, 6, "of");
  eq(r.above?.id, "c", "just above");
  eq(r.above?.rank, 3, "above's rank");
  eq(r.above?.gap, 50, "above gap");
  eq(r.below?.id, "d", "just below");
  eq(r.below?.rank, 5, "below's rank");
  eq(r.below?.gap, -50, "below gap");
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
  eq(r.below?.id, "d", "not its own old copy");
});

check("an outsider ranks the same as a member would", () => {
  // Membership only changes the wording ("is" / "would be"), not the maths.
  const outsider = rankInSquad(w("new", 875), squad);
  eq(outsider.rank, 2);
  eq(outsider.total, 6);
});

check("ties share the better rank", () => {
  const r = rankInSquad(w("x", 800), squad);
  eq(r.rank, 3, "ties with c at 800");
  eq(r.above?.id, "b", "strictly higher only");
  eq(r.below?.id, "c", "the tie sits below");
  eq(r.below?.rank, 3, "and shares the rank");
  eq(r.below?.gap, 0, "gap");
});

check("the best has nobody above", () => {
  const r = rankInSquad(w("x", 1000), squad);
  eq(r.rank, 1);
  eq(r.above, null);
  eq(r.below?.id, "a");
});

check("the last has nobody below", () => {
  const r = rankInSquad(w("x", 100), squad);
  eq(r.rank, 6);
  eq(r.below, null);
  eq(r.above?.id, "e");
});

check("the only player at the position", () => {
  const r = rankInSquad({ id: "x", name: "Goalie", position: "G", rating: 500 }, squad);
  eq(r.rank, 1);
  eq(r.total, 1);
  eq(r.above, null);
  eq(r.below, null);
});

check("ordinals", () => {
  eq([1, 2, 3, 4].map(ordinal).join(" "), "1st 2nd 3rd 4th", "1-4");
  eq([11, 12, 13].map(ordinal).join(" "), "11th 12th 13th", "teens");
  eq([21, 22, 23].map(ordinal).join(" "), "21st 22nd 23rd", "twenties");
  eq(ordinal(111), "111th", "hundreds");
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
