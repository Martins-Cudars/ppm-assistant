/**
 * Assertions for the two history-precision fixes - see test/README.md:
 *
 * - storage/historyMerge.ts: a same-day squad-overview or profile visit used
 *   to replace the training-progress page's decimal skills with whole numbers.
 * - base/gainCleaning.ts: whole-number daily history used to have its
 *   unchanged days skipped as "no training" while the gain was still counted
 *   when a number ticked up - a pace ~1.8x too high.
 */

import { mergeHistoryEntry } from "@/storage/historyMerge";
import { cleanedGains, isWholeNumberCapture } from "@/base/gainCleaning";
import { SkillHistoryEntry } from "@/types/SkillHistory";

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

// --- Merge ------------------------------------------------------------------------

type Entry = SkillHistoryEntry<unknown>;
const entry = (skills: Record<string, number> | undefined, extra: Partial<Entry> = {}): Entry => ({
  id: "1:2026-10-01",
  playerId: "1",
  date: "2026-10-01",
  capturedAt: "t",
  ...(skills ? { skills } : {}),
  ...extra,
});

check("merge: decimals survive a same-day whole-number capture", () => {
  const stored = entry({ defence: 72.94, passing: 36.5, goalie: 27 }, { source: "TrainingProgress", overallRating: 135 });
  const overview = entry({ defence: 72, passing: 36, goalie: 27 }, { source: "PlayersList", overallRating: 135, experience: 14 });
  const merged = mergeHistoryEntry(stored, overview);
  eq(merged.skills, { defence: 72.94, passing: 36.5, goalie: 27 }, "skills");
  eq(merged.source, "TrainingProgress", "source stays with the kept skills");
  eq(merged.experience, 14, "other fields still merge");
});

check("merge: decimals replace stored whole numbers (re-gathering repairs a day)", () => {
  const stored = entry({ defence: 72, passing: 36 }, { source: "PlayersList" });
  const gathered = entry({ defence: 72.94, passing: 36.5 }, { source: "TrainingProgress" });
  const merged = mergeHistoryEntry(stored, gathered);
  eq(merged.skills, { defence: 72.94, passing: 36.5 });
  eq(merged.source, "TrainingProgress");
});

check("merge: whole numbers that aren't the stored values rounded down are news, and win", () => {
  const stored = entry({ defence: 72.94, passing: 36.5 }, { source: "TrainingProgress" });
  const later = entry({ defence: 74, passing: 37 }, { source: "PlayersList" });
  const merged = mergeHistoryEntry(stored, later);
  eq(merged.skills, { defence: 74, passing: 37 });
  eq(merged.source, "PlayersList");
});

check("merge: an OR-only capture keeps the stored skills, and a first capture is taken as is", () => {
  const stored = entry({ defence: 72.94 }, { source: "TrainingProgress" });
  const unscouted = entry(undefined, { source: "PlayerProfile", overallRating: 400 });
  const merged = mergeHistoryEntry(stored, unscouted);
  eq(merged.skills, { defence: 72.94 });
  eq(merged.overallRating, 400);
  eq(mergeHistoryEntry(undefined, unscouted), unscouted);
});

// --- Cleaning ---------------------------------------------------------------------

const SKILLS = ["a", "b", "c", "d", "e", "f", "g"] as const;
type K = (typeof SKILLS)[number];
const iso = (day: number) => new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);

/** 0.1 points a day into every skill: 0.7 a day in all, the review's example. */
const trueSkills = (day: number) =>
  Object.fromEntries(SKILLS.map((k, i) => [k, 50 + i * 0.37 + day * 0.1])) as Record<K, number>;
const floored = (skills: Record<K, number>) =>
  Object.fromEntries(SKILLS.map((k) => [k, Math.floor(skills[k])])) as Record<K, number>;
const total = (gains: Record<K, number>) => SKILLS.reduce((sum, k) => sum + gains[k], 0);

check("a whole-number capture is told by its source, not by lacking decimals", () => {
  eq(isWholeNumberCapture({ date: iso(0), skills: { a: 410, b: 205 }, source: "PlayersList" }), true);
  eq(isWholeNumberCapture({ date: iso(0), skills: { a: 410, b: 205 }, source: "TrainingProgress" }), false);
  eq(isWholeNumberCapture({ date: iso(0), skills: { a: 410, b: 205 } }), false, "legacy, no source");
  eq(isWholeNumberCapture({ date: iso(0), skills: { a: 72.9, b: 36 }, source: "PlayersList" }), false, "kept decimals");
});

check("whole-number daily history: nothing skipped, the rate is the real one", () => {
  const window = Array.from({ length: 57 }, (_, day) => ({
    date: iso(day),
    skills: floored(trueSkills(day)),
    source: "PlayersList",
  }));
  const cleaned = cleanedGains(window, SKILLS, 56);
  eq(cleaned.skippedNoTrainingDays, 0, "no day can be judged flat");
  eq(cleaned.measuredDays, 56, "every day measured");
  eq(cleaned.measuredDailyDays, 0, "none of it judgeable day by day");
  // 0.7 a day; flooring both ends can move the total by under a point a skill.
  near(total(cleaned.gains) / cleaned.measuredDays, 0.7, 0.13, "points per day");
});

check("decimal daily history: a real flat day is still skipped", () => {
  const window = Array.from({ length: 31 }, (_, day) => ({
    date: iso(day),
    skills: trueSkills(day <= 10 ? day : day - 1), // day 11 repeats day 10: no training
    source: "TrainingProgress",
  }));
  const cleaned = cleanedGains(window, SKILLS, 30);
  eq(cleaned.skippedNoTrainingDays, 1);
  eq(cleaned.measuredDays, 29);
  near(total(cleaned.gains) / cleaned.measuredDays, 0.7, 1e-6, "undiluted");
});

check("mixed window: decimals then a whole-number tail - only real flat days are skipped", () => {
  const window = Array.from({ length: 57 }, (_, day) =>
    day <= 36
      ? { date: iso(day), skills: trueSkills(day === 20 ? 19 : day), source: "TrainingProgress" }
      : { date: iso(day), skills: floored(trueSkills(day)), source: "PlayersList" }
  );
  // Day 20 repeats day 19 (a real flat day); day 21 then carries two days' gain.
  const cleaned = cleanedGains(window, SKILLS, 56);
  eq(cleaned.skippedNoTrainingDays, 1, "the decimal flat day only");
  eq(cleaned.measuredDays, 55, "the 20 whole-number days are all kept");
  near(total(cleaned.gains) / 56, 0.7, 0.13, "close to the true rate over the window");
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
