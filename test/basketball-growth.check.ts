/**
 * Assertions for src/sports/basketball/growthModel.ts and the shared
 * src/base/gainCleaning.ts - see test/README.md.
 *
 * The cases that matter most:
 * - The reference is the top-5% line's smoothed rating gain, as rated-skill
 *   points a day (x3, the rated weights' sum); pace counts rated points only.
 * - Camp days are judged against the SAME skill's normal day. One player
 *   gained 0.74/day on speed and 1.13 on passing; judged against the overall
 *   median, his speed camp days fell below the bar and broke the camp in two.
 * - A player training exactly at the reference projects exactly the
 *   reference's points, age factors divided out and reapplied.
 */

import {
  AGE_PACE_FACTORS,
  BASKETBALL_REFERENCE_CURVE,
  CAMP_MAX_DAYS_PER_SEASON,
  HEIGHT_STOP_AGE,
  SMOOTHED_SEASON_GAINS,
  agePaceFactor,
  PACE_PROVISIONAL_MIN_DAYS,
  POTENTIAL_AGE,
  entryAge,
  projectBasketballXp,
  typicalXpAt,
  ReferenceCurve,
  basketballOverall,
  measureBasketballPace,
  projectBasketball,
  projectBasketballPotential,
  referencePointsBetween,
  solveBalancedBasketballRating,
} from "@/sports/basketball/growthModel";
import { BasketballSkills } from "@/sports/basketball/classes/BasketballPlayer";
import { cleanedGains } from "@/base/gainCleaning";
import {
  buildSquadBestCurve,
  historyPoints,
  projectionPoints,
} from "@/sports/basketball/historyChart";

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
  if (a === null || a === undefined || Math.abs(a - b) > tol) {
    throw new Error(`${m} expected ~${b}, got ${a}`);
  }
};
const eq = (a: unknown, b: unknown, m = "") => {
  if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

const TODAY = Date.parse("2026-09-30T12:00:00");
const iso = (daysAgo: number) =>
  new Date(TODAY - daysAgo * 86_400_000).toISOString().slice(0, 10);

const SKILLS: (keyof BasketballSkills)[] = [
  "shooting", "blocking", "passing", "technical", "speed", "aggression", "jumping",
];
const base = (): BasketballSkills => ({
  shooting: 50, blocking: 50, passing: 50, technical: 50, speed: 50, aggression: 50, jumping: 50,
});

/**
 * Daily history ending today: day i trains schedule[i % n] by gain(i, skill).
 * One skill a day, as basketball does.
 */
function history(
  days: number,
  schedule: (keyof BasketballSkills)[],
  gain: (i: number, skill: keyof BasketballSkills) => number,
  opts: { playerId?: string; height?: (i: number) => number } = {}
) {
  const skills = base();
  const entries = [];
  for (let i = 0; i <= days; i++) {
    if (i > 0) {
      const skill = schedule[i % schedule.length];
      skills[skill] += gain(i, skill);
    }
    entries.push({
      playerId: opts.playerId ?? "1",
      date: iso(days - i),
      skills: { ...skills },
      height: opts.height ? opts.height(i) : 190,
    });
  }
  return entries;
}

const flatCurve = (perDay: number): ReferenceCurve =>
  Array.from({ length: 20 }, (_, k) => ({ age: 15 + k, perDay, ratingPerSeason: (perDay * 70) / 3 }));

// --- Season length -------------------------------------------------------------

check("a basketball season is 70 days: 70 days ago the player was a year younger", () => {
  near(entryAge(iso(70), 20, TODAY), 19, 0.01);
});

// --- Camp detection -------------------------------------------------------------

check("per-skill camp baseline: a camp over a slow and a fast skill is one run", () => {
  // Speed trains at 0.74, passing at 1.13; days 30-39 are camp (2x each).
  const entries = history(56, ["speed", "passing"], (i, skill) =>
    (skill === "speed" ? 0.74 : 1.13) * (i >= 30 && i < 40 ? 2 : 1)
  );
  const overall = cleanedGains(entries, SKILLS, 56);
  const perSkill = cleanedGains(entries, SKILLS, 56, { perSkillCampBaseline: true });
  eq(perSkill.skippedCampDays, 10, "per-skill finds all 10");
  if (overall.skippedCampDays >= 10) throw new Error("the overall baseline was expected to miss some");
});

check("flat days are skipped and counted", () => {
  const entries = history(40, ["passing"], (i) => (i >= 10 && i < 13 ? 0 : 1));
  const cleaned = cleanedGains(entries, SKILLS, 40, { perSkillCampBaseline: true });
  eq(cleaned.skippedNoTrainingDays, 3);
  eq(cleaned.measuredDays, 37);
});

// --- Reference curve ------------------------------------------------------------

check("reference: the top-5% line's smoothed rating gain x3 rated points, per 70-day season", () => {
  const at = (age: number) => BASKETBALL_REFERENCE_CURVE.find((p) => p.age === age)!;
  near(at(18).perDay, (SMOOTHED_SEASON_GAINS[18] * 3) / 70, 1e-9, "18");
  near(at(28).ratingPerSeason, SMOOTHED_SEASON_GAINS[28], 1e-9, "28");
  eq(BASKETBALL_REFERENCE_CURVE[0].age, 15, "from 15");
  eq(BASKETBALL_REFERENCE_CURVE[BASKETBALL_REFERENCE_CURVE.length - 1].age, 34, "to 34");
  BASKETBALL_REFERENCE_CURVE.forEach((p) => {
    if (!(p.perDay >= 0)) throw new Error(`negative at ${p.age}`);
  });
});

check("reference: a 28-year-old at the squad's 28+ median doesn't read 150%", () => {
  // The squad's 28+ windows gained ~0.2 rated points a day (34% of the line at 28).
  const entries = history(56, ["passing", "aggression"], () => 0.2);
  const pace = measureBasketballPace(entries, 28.5, BASKETBALL_REFERENCE_CURVE, TODAY)!;
  if (!(pace.pace! < 1.5)) throw new Error(`read ${pace.pace}`);
  near(pace.pace, 0.2 / ((SMOOTHED_SEASON_GAINS[28] * 3) / 70), 1e-9, "rated points / the line's");
});

check("age factors: 1.00 to 24, 0.84 from 25, carried past 27", () => {
  eq(AGE_PACE_FACTORS.map((band) => band.factor).join(","), "1,1,0.84,0.84");
  eq(agePaceFactor(21.9), 1);
  eq(agePaceFactor(29), 0.84);
});

// --- Pace -----------------------------------------------------------------------

check("pace: training at the reference reads 100%, camp days left out", () => {
  const entries = history(56, ["passing", "technical"], (i) => (i >= 20 && i < 30 ? 2 : 1));
  const pace = measureBasketballPace(entries, 18.5, flatCurve(1), TODAY)!;
  near(pace.pace, 1, 1e-6);
  eq(pace.skippedCampDays, 10);
  eq(pace.provisional, false);
});

check("pace: provisional from a week, none before", () => {
  const week = history(PACE_PROVISIONAL_MIN_DAYS, ["passing"], () => 1);
  eq(measureBasketballPace(week, 16, flatCurve(1), TODAY)?.provisional, true);
  const short = history(PACE_PROVISIONAL_MIN_DAYS - 2, ["passing"], () => 1);
  eq(measureBasketballPace(short, 16, flatCurve(1), TODAY), null);
});

check("pace: skill shares follow the schedule; only rated points count", () => {
  const entries = history(56, ["passing", "passing", "shooting", "speed"], () => 1);
  const pace = measureBasketballPace(entries, 18, flatCurve(1), TODAY)!;
  near(pace.skillShares.passing, 0.5, 0.03);
  near(pace.skillShares.shooting, 0.25, 0.03);
  near(pace.pointsPerDay, 1, 1e-9, "all seven skills");
  near(pace.ratedPointsPerDay, 0.75, 0.03, "shooting left out");
  near(pace.pace, pace.ratedPointsPerDay, 1e-9, "against a 1.0 curve");
});

check("camp allowance: a camp in progress doesn't hide last season's, capped at 10", () => {
  // Last season's full camp 75-80 days back, and 5 days into this season's.
  const entries = history(130, ["passing"], (i) => ((i >= 50 && i < 60) || i >= 126 ? 2 : 1));
  const pace = measureBasketballPace(entries, 18, flatCurve(1), TODAY)!;
  eq(pace.campDaysPerSeason, CAMP_MAX_DAYS_PER_SEASON);
  eq(pace.campDaysAssumed, false);
});

check("height: steady growth measured; none once it has stopped", () => {
  const growing = history(120, ["passing"], () => 1, { height: (i) => 180 + Math.floor(i / 28) });
  // 1 cm every 28 days = 2.5 cm per 70-day season.
  near(measureBasketballPace(growing, 17, flatCurve(1), TODAY)!.heightPerSeason, 2.5, 0.1);
  const stopped = history(120, ["passing"], () => 1, { height: (i) => (i < 40 ? 180 + i / 10 : 184) });
  eq(measureBasketballPace(stopped, 17, flatCurve(1), TODAY)!.heightPerSeason, 0);
});

// --- Projection ------------------------------------------------------------------

check("points: pace 100% on a flat curve = reference x 70 days a season x the age factor", () => {
  near(referencePointsBetween(flatCurve(1), 27, 29, 10), 140 * 0.84, 1e-9, "no camps from 25, factor 0.84");
  // Before 25 the camp days add CAMP_DAY_EXTRA each.
  near(referencePointsBetween(flatCurve(1), 20, 21, 10), 80, 1e-9, "with camps");
});

check("balanced solver: points spent at the position's weights, bottleneck first", () => {
  const skills = base();
  skills.passing = 30; // PG's bottleneck (ratio 1.0)
  // PG ratios: 1, .8, .8, .2, .2. Up to R=62.5 only passing costs (0.8R <= 50),
  // so 30 points buy exactly R=60. R=70 costs 40 (passing) + 2 x 6 (technical,
  // speed at 56) = 52 - aggression and jumping (14) are still paid for.
  near(solveBalancedBasketballRating(skills, "PG", 30), 60, 1e-6, "bottleneck only");
  near(solveBalancedBasketballRating(skills, "PG", 52), 70, 1e-6, "then the next skills");
});

check("projection: all points land; shooting keeps its own rate; OR adds up", () => {
  const entries = history(56, ["passing", "technical", "speed", "shooting"], () => 1);
  const pace = measureBasketballPace(entries, 20, flatCurve(1), TODAY)!;
  const now = entries[entries.length - 1].skills;
  const projection = projectBasketball(now, 190, 27, { ...pace, campDaysPerSeason: 0 }, flatCurve(1), 28)!;
  // Measured at 20 (factor 1), one season at 27 (factor 0.84): 58.8 normal-day points,
  // 3/4 rated at the pace, 1/4 shooting at its own rate.
  near(projection.points, 70 * 0.84, 1e-6, "points");
  near(projection.skills.shooting - now.shooting, 0.25 * 70 * 0.84, 1, "shooting at its own rate");
  const added = SKILLS.reduce((sum, s) => sum + projection.skills[s] - now[s], 0);
  near(added, projection.points, 1e-3, "every point placed");
  near(projection.overall, basketballOverall(projection.skills), 0);
});

check("projection: the factor a pace was measured at is divided out", () => {
  const entries = history(56, ["passing", "technical", "speed"], () => 1);
  const at20 = measureBasketballPace(entries, 20, flatCurve(1), TODAY)!;
  const now = entries[entries.length - 1].skills;
  const a = projectBasketball(now, 190, 26, { ...at20, campDaysPerSeason: 0 }, flatCurve(1), 27)!;
  const b = projectBasketball(now, 190, 26, { ...at20, midAge: 26, campDaysPerSeason: 0 }, flatCurve(1), 27)!;
  // The same pace read at 26 stands for a faster underlying pace than at 20.
  near(b.points / a.points, 1 / 0.84, 1e-6, "1 / 0.84");
});

check("projection: height grows at its rate until the stop age, then holds", () => {
  const entries = history(120, ["passing"], () => 1, { height: (i) => 180 + Math.floor(i / 28) });
  const pace = measureBasketballPace(entries, 17, flatCurve(1), TODAY)!;
  const skills = entries[entries.length - 1].skills;
  const projection = projectBasketball(skills, 184, 17, pace, flatCurve(1), 25)!;
  eq(projection.height, Math.floor(184 + pace.heightPerSeason * (HEIGHT_STOP_AGE - 17)));
});

check("XP: future seasons add the squad's typical XP, whatever the player's past rate", () => {
  // 4 XP at 16.9 is ~2x typical: kept, but not multiplied forward.
  near(projectBasketballXp(4, 16.9, 18.9), 4 + typicalXpAt(18.9) - typicalXpAt(16.9), 1e-9);
  // A busier player keeps the XP earned, but adds typical XP from here.
  const at22 = typicalXpAt(22);
  near(projectBasketballXp(at22 * 2, 22, 23), at22 * 2 + (typicalXpAt(23) - at22), 1e-9);
});

check("potential: at or past the peak age shows the current value", () => {
  const potential = projectBasketballPotential(base(), 200, 90, POTENTIAL_AGE + 1, null, flatCurve(1), {
    rating: 150, ratingWithXp: 177, position: "C",
  });
  eq(potential?.kind, "current");
  eq(potential?.ratingWithXp, 177);
});

// --- Chart data ------------------------------------------------------------------

check("chart: history points are dated by age and thinned to ~2 weeks", () => {
  const entries = history(70, ["passing"], () => 1);
  const points = historyPoints(entries, 20, "or", 190, TODAY);
  if (points.length < 5 || points.length > 8) throw new Error(`${points.length} points`);
  near(points[0].x, 19, 0.02, "first day is a season ago");
  near(points[points.length - 1].x, 20, 0.02, "last day is today");
});

check("chart: OR-only days don't swallow a window's skill days", () => {
  const entries = history(28, ["passing"], () => 1).map((e, i) =>
    i % 2 === 0 ? e : { ...e, skills: undefined, overallRating: 400 }
  );
  const skill = historyPoints(entries, 20, "skill", 190, TODAY);
  if (skill.length < 2) throw new Error("skill line lost its points");
  if (skill.some((p) => !Number.isFinite(p.y))) throw new Error("non-numeric point");
});

check("chart: squad best is the highest value on reaching each whole age", () => {
  // Same schedule, A trains twice as fast; both are 20 today with a season of history.
  const a = history(70, ["passing", "technical", "speed", "aggression", "jumping"], () => 2, { playerId: "A" });
  const b = history(70, ["passing", "technical", "speed", "aggression", "jumping"], () => 1, { playerId: "B" });
  const best = buildSquadBestCurve(
    new Map([["A", a], ["B", b]]),
    new Map([["A", 20], ["B", 20]]),
    new Map([["A", 190], ["B", 190]]),
    TODAY
  );
  eq(best.or.map((p) => p.x).join(","), "19,20");
  near(best.or[1].y, Math.max(...a.slice(-1).map((e) => basketballOverall(e.skills))), 0, "A sets 20");
});

check("chart: projection starts at today's rating and never falls with a positive pace", () => {
  const entries = history(56, ["passing", "technical", "speed"], () => 1);
  const pace = measureBasketballPace(entries, 18, flatCurve(1), TODAY)!;
  const skills = entries[entries.length - 1].skills;
  const points = projectionPoints(skills, 190, 18, pace, flatCurve(1), 25);
  near(points[0].x, 18, 0, "starts now");
  eq(points[points.length - 1].x, 25);
  points.slice(1).forEach((p, i) => {
    if (p.y < points[i].y) throw new Error(`fell at ${p.x}`);
  });
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
