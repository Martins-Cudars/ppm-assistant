/**
 * Assertions for src/sports/soccer/growthPace.ts (the shared
 * src/base/growthModel.ts with soccer's constants) - see test/README.md.
 *
 * What matters:
 * - The reference is the top-player table up to 23, the squad's own decline
 *   from 24 (the user's choice - the table's slope collapses after 23).
 * - Juniors' faster pace is divided out by the age factors, so it isn't
 *   carried to 25.
 * - One skill a day at the position's ratios measures the same base pace as
 *   a split, and camps are found per skill.
 */

import {
  CAMP_MAX_DAYS_PER_SEASON,
  agePaceFactor,
  curveGainBetween,
  expectedSeasonGain,
  measureGrowthPace,
  projectPositionRating,
  projectExperience,
  projectPotential,
  projectionPoints,
} from "@/sports/soccer/growthPace";
import { SoccerSkills } from "@/sports/soccer/classes/SoccerPlayer";
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
const near = (a: number | null | undefined, b: number, tol = 1e-6, m = "") => {
  if (a === null || a === undefined || Math.abs(a - b) > tol) throw new Error(`${m} expected ~${b}, got ${a}`);
};
const eq = (a: unknown, b: unknown, m = "") => {
  if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

check("reference: the table's slope up to 23, the squad's own from 24", () => {
  eq(expectedSeasonGain(20.5), 70, "20: 455 -> 525");
  eq(expectedSeasonGain(23.2), 50, "23: 650 -> 700");
  eq(expectedSeasonGain(24.0), 46, "24: override (the table says 20)");
  eq(expectedSeasonGain(25.9), 44, "25: override (the table says 15)");
  eq(expectedSeasonGain(34.5), null, "34: 0 - no reference");
  near(curveGainBetween(23, 25), 96, 1e-9, "50 + 46");
});

check("age factors: juniors' faster pace is divided out", () => {
  eq(agePaceFactor(15.3), 1.4);
  eq(agePaceFactor(16.9), 1.18);
  eq(agePaceFactor(17), 1.0);
  eq(agePaceFactor(28), 1.0);
});

// --- A side midfielder trained one skill a day, at the SM ratios ---------------
// SM: midfield 1, speed 0.75, technical 0.5, passing 0.5, heading 0.25
// (Σ 3). A 12-day rotation of 4 midfield, 3 speed, 2 technical, 2 passing,
// 1 heading days, 1 point each, lands exactly on those ratios.
const ROTATION: (keyof SoccerSkills)[] = [
  "midfield", "speed", "technical", "midfield", "passing", "speed",
  "midfield", "heading", "technical", "speed", "midfield", "passing",
];
const base = (): SoccerSkills => ({
  goalie: 20, defence: 30, midfield: 200, offence: 30, shooting: 60,
  passing: 100, technical: 100, speed: 150, heading: 50,
});
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

function history(days: number, campDays: Set<number> = new Set()): SkillHistoryEntry<SoccerSkills>[] {
  const skills = base();
  const entries: SkillHistoryEntry<SoccerSkills>[] = [];
  for (let i = 0; i <= days; i++) {
    if (i > 0) skills[ROTATION[i % ROTATION.length]] += campDays.has(i) ? 2 : 1;
    entries.push({ id: `1:${iso(days - i)}`, playerId: "1", date: iso(days - i), skills: { ...skills }, capturedAt: "" });
  }
  return entries;
}

check("one skill a day at the ratios: 1 point/day = 112/season = 37.3 base", () => {
  const pace = measureGrowthPace(history(56), 20.5, "SM")!;
  near(pace.pointsPerSeason, 112, 0.5, "points");
  near(pace.basePerSeason, 112 / 3, 0.2, "base");
  near(pace.basePace, 112 / 3 / 70, 0.01, "vs the 20-21 slope of 70");
});

check("camps are found per skill: a heading camp day is 2x a heading day", () => {
  // Days 20-26 at camp: midfield days gain 2, heading days gain 2 - against
  // the overall median a heading day would never look like a camp.
  const camp = new Set([20, 21, 22, 23, 24, 25, 26]);
  const pace = measureGrowthPace(history(56, camp), 20.5, "SM")!;
  eq(pace.skippedCampDays, 7);
  near(pace.pointsPerSeason, 112, 0.5, "camp days left out");
});

check("camp allowance: assumed in full without a season of history", () => {
  const pace = measureGrowthPace(history(56), 18.5, "SM")!;
  eq(pace.campDaysAssumed, true);
  eq(pace.campDaysPerSeason, CAMP_MAX_DAYS_PER_SEASON);
});

check("projection: never falls with a positive pace, and stops past the max age", () => {
  const entries = history(56);
  const skills = entries[entries.length - 1].skills!;
  const pace = measureGrowthPace(entries, 20.5, "SM")!;
  const points = projectionPoints(skills, 20.5, pace, 40);
  eq(points[points.length - 1].x, 35, "capped at 35");
  points.slice(1).forEach((p, i) => {
    if (p.y < points[i].y) throw new Error(`fell at ${p.x}`);
  });
  const at25 = projectPositionRating(skills, 20.5, pace, 25)!;
  if (!(at25 > points[0].y)) throw new Error("@25 not above now");
});

check("a 15-year-old's catch-up pace isn't carried to 25", () => {
  const entries = history(56);
  const skills = entries[entries.length - 1].skills!;
  // The same history read at 15 vs at 17: the 15-year-old's pace is divided
  // by 1.4, so both project the same future growth from the same skills.
  const at15 = measureGrowthPace(entries, 15.5, "SM")!;
  const at17 = measureGrowthPace(entries, 17.5, "SM")!;
  const gain15 = projectPositionRating(skills, 17.5, at15, 25)!;
  const gain17 = projectPositionRating(skills, 17.5, at17, 25)!;
  if (gain15 >= gain17) throw new Error(`15-year-old projected ${gain15} >= ${gain17}`);
});

// Herberts Dzelzs: bought at 18 from an elite team, 42 XP at 19.2 (1.7x the
// table, the squad sits at 0.34-0.71). His own share once projected 401 XP at
// 32 and a 1,235 potential - 5 diamond stars - for a ~685 rating.
check("an elite-team junior's XP isn't extrapolated: 42 + typical", () => {
  // Table exp: 19 -> 22, 20 -> 35, 22 -> 62, 32 -> 238; shares 0.45 then 0.52.
  const exp19_2 = 22 + (35 - 22) * 0.2;
  const expected = 42 + (62 - exp19_2) * 0.45 + (238 - 62) * 0.52;
  near(projectExperience(42, 19.2, 32), expected, 1e-6);
  const rating = 685;
  const withXp = Math.round(rating * (1 + expected / 500));
  if (withXp >= 1200) throw new Error(`still diamond-capped: ${withXp}`);
});

check("potential: at or past 32 shows the current value", () => {
  const p = projectPotential(base(), 100, 33, null, { rating: 300, ratingWithXp: 360 });
  eq(p?.kind, "current");
  eq(p?.ratingWithXp, 360);
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
