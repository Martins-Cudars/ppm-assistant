/**
 * Assertions for src/sports/basketball/capture.ts - see test/README.md.
 *
 * Basketball has no history page: these daily snapshots are the only history
 * it will ever have, so a malformed id or a dropped field is lost for good.
 * The id cases matter most - the squad-overview parser stores the whole
 * profile link as the "id", and a link stored as a player id would become a
 * phantom player.
 */

import { BasketballPlayer } from "@/sports/basketball/classes/BasketballPlayer";
import {
  buildBasketballEntry,
  deserializeBasketballPlayer,
  normalizePlayerId,
} from "@/sports/basketball/capture";

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

const skills = {
  shooting: 60,
  blocking: 40,
  passing: 120,
  technical: 110,
  speed: 100,
  aggression: 30,
  jumping: 25,
};

const makePlayer = (id: string, extra: { experience?: number; height?: number } = {}) =>
  new BasketballPlayer(
    {
      id,
      name: "Test Guard",
      age: 19,
      careerLongitivity: 3,
      overallRating: 485,
      averageTrainingRatio: 70,
      height: extra.height ?? 188,
    },
    new Date(),
    true,
    1,
    skills,
    extra.experience ?? 14
  );

check("ids: a plain number passes through", () => {
  eq(normalizePlayerId("23869664"), "23869664");
});

check("ids: the number is taken from a profile link's data parameter", () => {
  eq(normalizePlayerId("/en/player-profile?data=23869664-some-name"), "23869664");
  eq(normalizePlayerId("https://basketball.powerplaymanager.com/lv/speletaja-profils?data=555-x"), "555");
});

check("ids: a path-style link falls back to the last segment", () => {
  eq(normalizePlayerId("/en/player-profile/777"), "777");
});

check("ids: anything without a number is rejected, not stored", () => {
  eq(normalizePlayerId("unknown"), null, "unknown");
  eq(normalizePlayerId(""), null, "empty");
  eq(normalizePlayerId(undefined), null, "undefined");
  eq(normalizePlayerId("/en/player-profile?data=abc"), null, "non-numeric");
});

check("the entry carries skills, OR, height and XP under a player:date id", () => {
  const entry = buildBasketballEntry(makePlayer("/en/player-profile?data=42-guard"), "PlayersList", "2026-10-01")!;
  eq(entry.id, "42:2026-10-01", "id");
  eq(entry.playerId, "42", "playerId");
  eq(entry.overallRating, 485, "OR");
  eq(entry.skills?.passing, 120, "skills");
  eq(entry.height, 188, "height");
  eq(entry.experience, 14, "experience");
  eq(entry.source, "PlayersList", "source");
});

check("unread fields are left out, so the merge keeps stored values", () => {
  const player = makePlayer("42");
  (player as { height: number }).height = 0;
  const entry = buildBasketballEntry(player, "PlayerProfile", "2026-10-01")!;
  eq("height" in entry, false, "no height key at all, not height: undefined");
});

check("no entry for a player without a usable id", () => {
  eq(buildBasketballEntry(makePlayer("unknown"), "PlayersList"), null);
});

// The report and the squad-rank card rebuild players from the cache; the
// ratings must come out as if the player had been parsed from the page.
check("a cached player comes back with the same position ratings, height included", () => {
  const original = makePlayer("42", { height: 214, experience: 30 });
  original.calculatePositions();
  const restored = deserializeBasketballPlayer({
    sport: "basketball",
    baseInfo: {
      id: "42",
      name: original.name,
      age: original.age,
      careerLongitivity: original.careerLongitivity,
      overallRating: original.overallRating,
      averageTrainingRatio: original.averageTrainingRatio,
      height: 214,
      teamId: "9",
    },
    skills,
    trainingQualities: null,
    experience: 30,
    injuryDays: 0,
    scoutingStatus: "SCOUTED",
    metadata: {
      updatedAt: "2026-10-01T10:00:00.000Z",
      seasonDay: 40,
      dataCompleteness: "partial",
      lastViewSource: "PlayersList",
    },
  });
  eq(
    restored.getPositions().map((p) => `${p.name}:${p.ratingWithXp}`).join(" "),
    original.getPositions().map((p) => `${p.name}:${p.ratingWithXp}`).join(" "),
    "all five positions"
  );
  eq(restored.teamId, "9", "team id carried over");
  eq(restored.updatedAt.toISOString(), "2026-10-01T10:00:00.000Z", "updated at");
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
