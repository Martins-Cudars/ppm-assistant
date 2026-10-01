/**
 * Assertions for src/sports/soccer/capture.ts - see test/README.md.
 *
 * What matters: ids are numbers taken from the profile link (never the
 * country flag's data=lva), an unscouted player's estimated XP is never
 * stored as if read, and a cached player rebuilds with the same ratings.
 */

import { SoccerPlayer, SoccerSkills } from "@/sports/soccer/classes/SoccerPlayer";
import {
  buildSoccerEntry,
  deserializeSoccerPlayer,
  serializeSoccerPlayer,
} from "@/sports/soccer/capture";
import { normalizePlayerId } from "@/base/captureUtils";

// serializeSoccerPlayer() reads the season day from the game page; under node
// there is none, so stub a page without the info bar (getCurrentSeasonDay -> 1).
(globalThis as unknown as { document: unknown }).document = { querySelector: () => null };

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

// A centre-back from the live squad: secondaries at fixed fractions of defence.
const skills: SoccerSkills = {
  goalie: 26,
  defence: 433,
  midfield: 65,
  offence: 65,
  shooting: 108,
  passing: 217,
  technical: 217,
  speed: 217,
  heading: 217,
};

const makePlayer = (id: string, visible = true) =>
  new SoccerPlayer(
    { id, name: "Test Back", age: 25, careerLongitivity: 3, overallRating: 1565, averageTrainingRatio: 70 },
    new Date(),
    visible,
    visible,
    25,
    visible ? skills : undefined,
    visible ? 53 : undefined
  );

check("ids: profile links and plain numbers; the country flag is rejected", () => {
  eq(normalizePlayerId("https://soccer.powerplaymanager.com/en/player.html?data=31031375-reinis-ritins"), "31031375");
  eq(normalizePlayerId("31031375"), "31031375");
  eq(normalizePlayerId("https://soccer.powerplaymanager.com/en/country-profile.html?data=lva"), null);
  eq(normalizePlayerId("soccer-list-3"), null, "the parser's fallback id");
});

check("the entry carries skills, OR and XP under a player:date id", () => {
  const entry = buildSoccerEntry(makePlayer("/en/player.html?data=42-back"), "PlayersList", "2026-10-01")!;
  eq(entry.id, "42:2026-10-01");
  eq(entry.overallRating, 1565);
  eq(entry.skills?.defence, 433);
  eq(entry.experience, 53);
  eq("height" in entry, false, "soccer has no height");
});

check("an unscouted profile gives an OR-only day - no skills, no estimated XP", () => {
  const entry = buildSoccerEntry(makePlayer("42", false), "PlayerProfile", "2026-10-01")!;
  eq(entry.overallRating, 1565);
  eq("skills" in entry, false, "skills");
  eq("experience" in entry, false, "experience");
  eq(serializeSoccerPlayer(makePlayer("42", false), "PlayerProfile", "9"), null, "not cached");
});

check("a cached player comes back with the same position ratings", () => {
  const original = makePlayer("42");
  original.calculatePositions();
  const stored = serializeSoccerPlayer(original, "PlayersList", "142317")!;
  const restored = deserializeSoccerPlayer(stored);
  eq(
    restored.getPositions().map((p) => `${p.name}:${p.ratingWithXp}`).join(" "),
    original.getPositions().map((p) => `${p.name}:${p.ratingWithXp}`).join(" "),
    "all positions"
  );
  eq(restored.getBestPosition().name, "CD");
  eq(restored.teamId, "142317");
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
