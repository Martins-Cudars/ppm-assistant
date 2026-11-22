/**
 * Assertions for src/sports/soccer/growthPace.ts (the shared
 * src/base/growthModel.ts with soccer's constants) - see test/README.md.
 *
 * What matters:
 * - The reference is the top-5% line's smoothed growth rate
 *   (smoothedSeasonGains) up to 23, the squad's own decline from 24, scaled
 *   to the smoothed rate at 23 (the user's choice).
 * - Juniors' faster pace is divided out by the junior correction of the
 *   rate (JUNIOR_RATE_FACTORS), so an average 15-year-old doesn't read 100%
 *   and his pace isn't carried to 25.
 * - One skill a day at the position's ratios measures the same base pace as
 *   a split, and camps are found per skill.
 */

import {
  CAMP_MAX_DAYS_PER_SEASON,
  JUNIOR_RATE_FACTORS,
  OR_JUNIOR_RATE_FACTORS,
  OR_SMOOTHED_SEASON_GAINS,
  agePaceFactor,
  curveGainBetween,
  juniorRates,
  uncorrectedSeasonGain,
  expectedSeasonGain,
  measureGrowthPace,
  projectPositionRating,
  projectExperience,
  projectPotential,
  projectionPoints,
} from "@/sports/soccer/growthPace";
import { relativeSkillReference } from "@/sports/soccer/relativeSkillReference";
import { smoothedSeasonGains } from "@/base/relativeSkillFit";
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

const expAt = (age: number) => relativeSkillReference.find((row) => row.age === age)!.exp;
const smoothed = smoothedSeasonGains(relativeSkillReference);
const slope20 = smoothed[20];
const slope23 = smoothed[23];

check("reference: the top-5% line's smoothed rate up to 23, the squad's own from 24", () => {
  eq(expectedSeasonGain(20.5), slope20, "20 -> 21");
  eq(Math.round(slope23), 52, "23 -> 24, smoothed, on the 2026-11-22 line");
  eq(expectedSeasonGain(23.2), slope23, "23 -> 24");
  eq(expectedSeasonGain(24.0), Math.round(0.92 * slope23), "24: the squad's 0.92 of the slope at 23");
  eq(expectedSeasonGain(25.9), Math.round(0.88 * slope23), "25: 0.88");
  eq(expectedSeasonGain(34.5), null, "34: 0 - no reference");
  near(curveGainBetween(23, 25), slope23 + Math.round(0.92 * slope23), 1e-9, "23 + 24");
});

check("juniors: the rate at 15 and 16 carries the correction, the age factors are 1", () => {
  near(expectedSeasonGain(15.3), smoothed[15] * 1.78, 1e-9, "15: 1.78 x the line's rate");
  near(expectedSeasonGain(16.9), smoothed[16] * 1.23, 1e-9, "16: 1.23 x");
  eq(expectedSeasonGain(17.2), smoothed[17], "17: the line's rate");
  [15.3, 16.9, 17, 28].forEach((age) => eq(agePaceFactor(age), 1.0, `factor at ${age}`));
});

check("juniors: every corrected age is on the line, and a missing one is left out, not NaN", () => {
  Object.keys(JUNIOR_RATE_FACTORS).forEach((age) => {
    if (!Number.isFinite(smoothed[Number(age)])) throw new Error(`the line has no rate at ${age}`);
  });
  Object.keys(OR_JUNIOR_RATE_FACTORS).forEach((age) => {
    if (!Number.isFinite(OR_SMOOTHED_SEASON_GAINS[Number(age)])) throw new Error(`the OR line has no rate at ${age}`);
  });
  const partial = juniorRates({ 16: 50 }, { 15: 1.78, 16: 1.23 });
  eq(JSON.stringify(partial), JSON.stringify({ 16: 61.5 }), "15 left out");
});

check("juniors: League / Elite take the shape without the correction", () => {
  eq(uncorrectedSeasonGain(15.5), smoothed[15], "15: the line's own rate");
  eq(uncorrectedSeasonGain(17.5), expectedSeasonGain(17.5), "17: the same as Pace's");
  eq(uncorrectedSeasonGain(25.5), expectedSeasonGain(25.5), "25: the squad's decline");
  eq(uncorrectedSeasonGain(35), null, "past the projection age");
});

check("juniors: the same points read the same Pace at 15 as the squad median does at 17", () => {
  // 0.53 x the rate at 17 is the 17+ median; a 15-year-old who gains what the
  // measured 15-year-old median gains (0.95 of the line's raw rate at 15)
  // reads about the same, not 95%.
  const pace15 = (0.95 * smoothed[15]) / expectedSeasonGain(15.5)!;
  near(pace15, 0.53, 0.02, "15-year-old median");
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
  near(pace.basePace, 112 / 3 / slope20, 0.01, "vs the line's 20-21 slope");
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
  // by its factor, so it never projects more growth than at 17.
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
  // The line's XP at 19.2, 22 and 32; shares 0.43 then 0.40.
  const exp19_2 = expAt(19) + (expAt(20) - expAt(19)) * 0.2;
  const expected = 42 + (expAt(22) - exp19_2) * 0.43 + (expAt(32) - expAt(22)) * 0.4;
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
