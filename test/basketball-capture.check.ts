/**
 * Assertions for src/sports/basketball/capture.ts and the profile parser's
 * unscouted case - see test/README.md.
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
import { parseBasketballPlayerFromProfilePage } from "@/sports/basketball/parsers/playerProfile";
import { relativeSkillView } from "@/base/relativeSkill";

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

// The first link in an overview name cell is the country flag. Its "id" must
// never be taken for a player - this is what once stored nothing at all.
check("ids: a country-flag link is rejected", () => {
  eq(normalizePlayerId("https://basketball.powerplaymanager.com/en/country-profile.html?data=lva"), null);
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

// --- An unscouted player's profile page --------------------------------------
// The user's live crash (2026-11-23): "Missing numeric value for selector:
// #shooting". An unscouted profile shows "-" for every skill and quality; only
// OR (KR), age, height, CL and a few info fields have values. The fixture is
// the profile table's cells by selector, as the parser queries them.
const unscoutedCells: Record<string, string> = {
  "#age": "28",
  "#index_skill": "2 712",
  "#vyska": "201",
  "#life_time span": "4/6",
  "#shooting": "-",
  "#block": "-",
  "#passing": "-",
  "#technique_attribute": "-",
  "#speed": "-",
  "#aggressivity": "-",
  "#leaping": "-",
  "#kva_shooting": "-",
  "#kva_block": "-",
  "#kva_passing": "-",
  "#technique_quality": "-",
  "#kva_speed": "-",
  "#kva_aggressivity": "-",
  // "#kva_leaping" and "#experience" missing altogether.
};
const fixture = (cells: Record<string, string>) =>
  ({
    querySelector: (selector: string) => (selector in cells ? { textContent: cells[selector] } : null),
    querySelectorAll: () => [{ textContent: "Latvia" }, { textContent: "Unscouted Centre" }],
  }) as unknown as ParentNode & Element;

check("unscouted profile: parses without throwing; skills unknown, OR and age read", () => {
  const player = parseBasketballPlayerFromProfilePage(fixture(unscoutedCells), fixture(unscoutedCells), 20, "77-c");
  eq(player.skills, undefined, "skills");
  eq(player.qualities, undefined, "qualities");
  eq(player.overallRating, 2712, "OR");
  eq(player.age, 28, "age");
  eq(player.height, 201, "height");
  eq(player.experienceKnown, false, "XP not shown, so not known");
  eq(player.hasKnownSkills(), false, "skills known");
  player.calculatePositions();
  player.calculatePositionTrainingQualities();
  const best = player.getBestPosition();
  eq(Number.isFinite(best.ratingWithXp) && Number.isFinite(best.ratingWithBonus), true, "no NaN rating");
  // The potential card reads the current position's quality: no throw, no NaN.
  eq(Number.isFinite(player.getCurrentPositionTrainingQuality().totalTrainingQuality), true, "potential card");
  const maxima = player.getRelativeSkillMaxima(null);
  eq(maxima.skillsUnknown, true, "relative skill unknown");
  const view = relativeSkillView(best.ratingWithXp, maxima, player.age, { kind: "fitted" });
  eq(`${view.global}/${view.league}/${view.title}`, "null/null/Unscouted player: skills unknown", "??? / ???");

  // History: an OR-only row, no skills and no guessed XP.
  const entry = buildBasketballEntry(player, "PlayerProfile", "2026-11-23")!;
  eq(entry.overallRating, 2712, "OR stored");
  eq(entry.skills, undefined, "no skills stored");
  eq(entry.experience, undefined, "no XP stored");
  eq(entry.height, 201, "height stored");
});

check("scouted profile: still parsed in full", () => {
  const cells = {
    ...unscoutedCells,
    "#shooting": "60", "#block": "40", "#passing": "120", "#technique_attribute": "110",
    "#speed": "100", "#aggressivity": "30", "#leaping": "25",
    "#kva_shooting": "70", "#kva_block": "70", "#kva_passing": "70", "#technique_quality": "70",
    "#kva_speed": "70", "#kva_aggressivity": "70", "#kva_leaping": "70", "#experience": "105",
  };
  const player = parseBasketballPlayerFromProfilePage(fixture(cells), fixture(cells), 20, "77-c");
  eq(player.skills?.jumping, 25, "skills");
  eq(player.averageTrainingRatio, 70, "AvQ");
  eq([player.experience, player.experienceKnown].join(), "105,true", "XP");
  eq(buildBasketballEntry(player, "PlayerProfile", "2026-11-23")!.experience, 105, "XP stored");
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
