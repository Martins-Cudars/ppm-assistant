/**
 * Assertions for growthPace.ts - see test/README.md for how to run these.
 *
 * Two groups matter most:
 *
 * - The catch-up and non-bottleneck cases. Base rating is the position's
 *   bottleneck skill over its weight, so rating movement misreports training
 *   whenever the main skills are unbalanced - the reason pace is measured in
 *   skill points. A 15-year-old catching up defence read 97% by rating.
 * - "A balanced on-curve player at 100% lands on the curve": what makes the
 *   Proj column and the chart's dashed line mean what they say.
 */

import {
  GrowthPace,
  PACE_MIN_SPAN_DAYS,
  PACE_WINDOW_DAYS,
  curveGainBetween,
  dateAtAge,
  entryNearestDate,
  expectedSeasonGain,
  measureGrowthPace,
  overallFromSkills,
  projectOverallRating,
  projectPositionRating,
  projectionPoints,
  solveBalancedRating,
} from "@/sports/hockey/growthPace";
import { HockeySkills } from "@/sports/hockey/classes/HockeyPlayer";
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
  if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

const near = (a: number | null | undefined, b: number, m = "", tolerance = 1e-6) => {
  if (a === null || a === undefined || Math.abs(a - b) > tolerance) {
    throw new Error(`${m} expected ~${b}, got ${a}`);
  }
};

// Dates relative to today: historyEntryAge() measures back from Date.now().
const daysAgo = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

const skills = (s: Partial<HockeySkills>): HockeySkills => ({
  goalie: 0,
  defence: 0,
  offence: 0,
  shooting: 0,
  passing: 0,
  technical: 0,
  aggression: 0,
  ...s,
});

/** A defender's day: D rates as min(defence, passing / 0.5, aggression / 0.5). */
const dDay = (ago: number, defence: number, passing: number, aggression: number) => ({
  id: `1:${daysAgo(ago)}`,
  playerId: "1",
  date: daysAgo(ago),
  skills: skills({ defence, passing, aggression }),
  capturedAt: "2026-09-25T00:00:00.000Z",
});

/** A day with an overall rating but no skills - an unscouted profile visit. */
const ratingOnly = (ago: number): SkillHistoryEntry => ({
  id: `1:${daysAgo(ago)}`,
  playerId: "1",
  date: daysAgo(ago),
  overallRating: 999,
  capturedAt: "2026-09-25T00:00:00.000Z",
});

/** A pace to project from, without having to build a history for it. */
const paceOf = (
  position: string,
  pace: number,
  expectedPerSeason: number,
  rates: Partial<HockeySkills> = {}
): GrowthPace => ({
  position,
  pointsPerSeason: 0,
  gainPerSeason: pace * expectedPerSeason,
  ratingMovedPerSeason: 0,
  skillRates: skills(rates),
  expectedPerSeason,
  pace,
  midAge: 18,
  fromDate: daysAgo(20),
  toDate: daysAgo(0),
  spanDays: 20,
});

check("expected gain is the slope of the year the age falls in", () => {
  eq(expectedSeasonGain(18), 101, "18 -> 19");
  eq(expectedSeasonGain(18.99), 101, "still 18 -> 19");
  eq(expectedSeasonGain(17.99), 104, "17 -> 18");
});

check("expected gain is null from 35 on and outside the table", () => {
  eq(expectedSeasonGain(35), null, "35");
  eq(expectedSeasonGain(40), null, "40");
  eq(expectedSeasonGain(14), null, "14");
  eq(expectedSeasonGain(NaN), null, "NaN");
});

check("curve gain walks the table year by year and stops at 35", () => {
  near(curveGainBetween(18, 25), 1093 - 450, "whole ages");
  near(curveGainBetween(18.5, 19), 50.5, "part of a year");
  near(curveGainBetween(30, 40), 1596 - 1423, "capped at 35");
});

// --- Measuring pace ---------------------------------------------------------

check("balanced training: pace from points matches rating movement", () => {
  // +20 def, +10 pas, +10 agg over 20 days: base 400 -> 420.
  const result = measureGrowthPace([dDay(20, 400, 200, 200), dDay(0, 420, 210, 210)], 18.5, "D")!;
  near(result.pointsPerSeason, (40 / 20) * 112, "points");
  near(result.gainPerSeason, (20 / 20) * 112, "rating when balanced");
  near(result.ratingMovedPerSeason, result.gainPerSeason, "rating moved the same");
  eq(result.expectedPerSeason, 101, "expected at midpoint age ~18.4");
  near(result.pace, result.gainPerSeason / 101, "pace");
});

check("catch-up: a bottleneck being filled doesn't inflate pace", () => {
  // Modelled on a real 15-year-old: nearly all points into defence, the
  // bottleneck. Base 90 -> 119, but only 30.5 points went in.
  const result = measureGrowthPace([dDay(28, 90, 60, 60), dDay(0, 119, 61, 60.5)], 15.5, "D")!;
  near(result.ratingMovedPerSeason, (29 / 28) * 112, "rating moved ~1:1 with points");
  near(result.gainPerSeason, (30.5 / 2 / 28) * 112, "pace counts 2 points per rating");
  eq(result.gainPerSeason < 0.6 * result.ratingMovedPerSeason, true, "about half");
});

check("non-bottleneck: points into a surplus skill still count", () => {
  // Passing and aggression are the bottleneck (40 / 0.5 = 80); defence isn't.
  const result = measureGrowthPace([dDay(20, 100, 40, 40), dDay(0, 120, 40, 40)], 18.5, "D")!;
  near(result.ratingMovedPerSeason, 0, "rating flat");
  near(result.gainPerSeason, (20 / 2 / 20) * 112, "pace still > 0");
});

check("no pace below the minimum span", () => {
  eq(
    measureGrowthPace([dDay(PACE_MIN_SPAN_DAYS - 1, 400, 200, 200), dDay(0, 420, 210, 210)], 18.5, "D"),
    null
  );
});

check("no pace from a single usable day", () => {
  eq(measureGrowthPace([dDay(0, 420, 210, 210)], 18.5, "D"), null);
});

check("no pace for an unknown position", () => {
  eq(measureGrowthPace([dDay(20, 400, 200, 200), dDay(0, 420, 210, 210)], 18.5, "?"), null);
});

check("days without skills are ignored, not read as zero", () => {
  const result = measureGrowthPace(
    [dDay(20, 400, 200, 200), dDay(5, 420, 210, 210), ratingOnly(0)],
    18.5,
    "D"
  )!;
  eq(result.toDate, daysAgo(5), "window ends at the last day with skills");
  eq(result.fromDate, daysAgo(20), "from");
});

check("the window anchors on the latest day, not on the oldest", () => {
  const result = measureGrowthPace(
    [dDay(60, 300, 150, 150), dDay(20, 400, 200, 200), dDay(0, 420, 210, 210)],
    18.5,
    "D"
  )!;
  eq(result.fromDate, daysAgo(20), "oldest day in window");
  eq(PACE_WINDOW_DAYS >= 20, true, "test assumes a window of at least 20 days");
});

check("a stale player still gets a pace for the period they were seen", () => {
  const result = measureGrowthPace([dDay(100, 400, 200, 200), dDay(80, 420, 210, 210)], 18.5, "D")!;
  eq(result.toDate, daysAgo(80), "as-of date is the sighting, not today");
});

check("pace is null (with a raw rate) once the curve stops growing", () => {
  const result = measureGrowthPace([dDay(20, 400, 200, 200), dDay(0, 420, 210, 210)], 36, "D")!;
  eq(result.pace, null, "pace");
  eq(result.expectedPerSeason, null, "expected");
  eq(result.gainPerSeason > 0, true, "raw rate still reported");
});

// --- Spending points --------------------------------------------------------

check("balanced skills: every rating point costs the weights' sum", () => {
  near(solveBalancedRating(skills({ defence: 450, passing: 225, aggression: 225 }), "D", 2 * 643), 1093);
});

check("the bottleneck is filled first, at its own rate", () => {
  // Passing is the bottleneck (50 / 0.5 = 100); the others sit at 200. Each
  // passing point is worth 2 rating points until it catches up.
  near(solveBalancedRating(skills({ defence: 200, passing: 50, aggression: 100 }), "D", 20), 140);
});

check("surplus skill counts as already paid for", () => {
  // Passing is ahead (80 / 0.5 = 160), so up to 160 only defence and aggression
  // cost anything: 1.5 points per rating point.
  near(
    solveBalancedRating(skills({ defence: 100, passing: 80, aggression: 50 }), "D", 10),
    100 + 10 / 1.5
  );
});

// --- Projecting ---------------------------------------------------------------

// The invariant the Proj column and chart line rest on.
check("a balanced on-curve player at 100% lands on the curve", () => {
  const onCurve = skills({ defence: 450, passing: 225, aggression: 225 });
  eq(projectPositionRating(onCurve, 18, paceOf("D", 1, 101), 25), 1093);
});

check("a 60% pace buys 60% of the curve's gain", () => {
  // 0.6 rather than 0.5: 0.5 lands on x.5, where the bisection's last bit
  // decides which way calculatePositions() rounds.
  const onCurve = skills({ defence: 450, passing: 225, aggression: 225 });
  eq(projectPositionRating(onCurve, 18, paceOf("D", 0.6, 101), 20), Math.round(450 + 0.6 * 199));
});

check("non-main skills keep their own rate and feed the bonus", () => {
  // W: offence 1, technical 0.5, aggression 0.5; bonus shooting 0.45.
  // One year at 100%: base 450 -> 551, shooting 100 -> 120 at +20/season,
  // bonus floor(0.45 * 120) = 54.
  const winger = skills({ offence: 450, technical: 225, aggression: 225, shooting: 100 });
  eq(projectPositionRating(winger, 18, paceOf("W", 1, 101, { shooting: 20 }), 19), 551 + 54);
});

check("projection stops at 35", () => {
  const onCurve = skills({ defence: 1423, passing: 711.5, aggression: 711.5 });
  eq(projectPositionRating(onCurve, 30, paceOf("D", 1, 58), 40), 1596);
});

check("no projection without a pace or skills, or at or past the target", () => {
  const onCurve = skills({ defence: 450, passing: 225, aggression: 225 });
  eq(projectPositionRating(onCurve, 18, null, 25), null, "no pace");
  eq(projectPositionRating(undefined, 18, paceOf("D", 1, 101), 25), null, "no skills");
  eq(projectPositionRating(onCurve, 25, paceOf("D", 1, 101), 25), null, "at target");
  eq(projectPositionRating(onCurve, 35, paceOf("D", 1, 101), 40), null, "at 35");
});

check("projection points start at the current rating and step by whole ages", () => {
  const onCurve = skills({ defence: 450, passing: 225, aggression: 225 });
  const points = projectionPoints(onCurve, 18, paceOf("D", 1, 101), 21);
  eq(points.map((p) => p.x).join(","), "18,19,20,21", "ages");
  eq(points.map((p) => p.y).join(","), "450,551,649,746", "on the curve");
  eq(projectionPoints(onCurve, 18, null, 21).length, 0, "empty without a pace");
});

// --- Overall rating and the @25 lookups -------------------------------------

check("overall rating is the sum of skills rounded down one by one", () => {
  // A real training-progress day: a plain sum gives 404.64, the game shows 403.
  const day = skills({
    goalie: 37,
    defence: 93.83,
    offence: 49,
    shooting: 55,
    passing: 55,
    technical: 47.81,
    aggression: 67,
  });
  eq(overallFromSkills(day), 403);
});

check("projected OR sums the projected skills", () => {
  // One year on the curve at 100%: def 450 -> 551, pas and agg 225 -> 275.5.
  const onCurve = skills({ defence: 450, passing: 225, aggression: 225 });
  eq(projectOverallRating(onCurve, 18, paceOf("D", 1, 101), 19), 551 + 275 + 275);
});

check("projected OR includes non-main skills at their own rate", () => {
  const winger = skills({ offence: 450, technical: 225, aggression: 225, shooting: 100 });
  eq(
    projectOverallRating(winger, 18, paceOf("W", 1, 101, { shooting: 20 }), 19),
    551 + 275 + 275 + 120
  );
});

check("no projected OR without a pace", () => {
  eq(projectOverallRating(skills({ defence: 450 }), 18, null, 25), null);
});

check("the date a player turned an age counts 112 days per season", () => {
  const expected = new Date(Date.now() - 1.5 * 112 * 86_400_000).toISOString().slice(0, 10);
  eq(dateAtAge(26.5, 25), expected);
});

check("the nearest day with skills is picked, within the tolerance", () => {
  const target = daysAgo(20);
  const entries = [dDay(30, 400, 200, 200), ratingOnly(23), dDay(15, 410, 205, 205)];
  eq(entryNearestDate(entries, target, 14)?.date, daysAgo(15), "5 days beats 10; OR-only skipped");
  eq(entryNearestDate(entries, target, 4), null, "nothing with skills within 4 days");
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
