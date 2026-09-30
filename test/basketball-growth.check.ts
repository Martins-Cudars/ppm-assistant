/**
 * Assertions for src/sports/basketball/growthModel.ts and the shared
 * src/base/gainCleaning.ts - see test/README.md.
 *
 * The cases that matter most:
 * - The reference is the squad's best at each age, never rising after the
 *   peak, and filled from the default curve where there's no data.
 * - Camp days are judged against the SAME skill's normal day. One player
 *   gained 0.74/day on speed and 1.13 on passing; judged against the overall
 *   median, his speed camp days fell below the bar and broke the camp in two.
 * - A player training exactly at the reference projects exactly the
 *   reference's points.
 */

import {
  CAMP_MAX_DAYS_PER_SEASON,
  DEFAULT_REFERENCE,
  HEIGHT_STOP_AGE,
  PACE_PROVISIONAL_MIN_DAYS,
  POTENTIAL_AGE,
  ReferenceCurve,
  basketballOverall,
  buildReferenceCurve,
  measureBasketballPace,
  projectBasketball,
  projectBasketballPotential,
  referencePointsBetween,
  solveBalancedBasketballRating,
} from "@/sports/basketball/growthModel";
import { BasketballSkills } from "@/sports/basketball/classes/BasketballPlayer";
import { cleanedGains } from "@/base/gainCleaning";

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
  Array.from({ length: 20 }, (_, k) => ({ age: 15 + k, perDay, source: "squad" as const }));

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

check("reference: the best player at each age, non-increasing after the peak", () => {
  // Two players with 2 seasons each, on whole-age boundaries: A was 18-20, B 22-24.
  const a = history(224, ["passing"], (i) => (i <= 112 ? 1.2 : 1.0), { playerId: "A" });
  const b = history(224, ["passing"], (i) => (i <= 112 ? 0.8 : 0.9), { playerId: "B" });
  const curve = buildReferenceCurve(
    new Map([["A", a], ["B", b]]),
    new Map([["A", 20], ["B", 24]]),
    TODAY
  );
  const at = (age: number) => curve.find((p) => p.age === age)!;
  near(at(18).perDay, 1.2, 0.02, "18");
  near(at(19).perDay, 1.0, 0.02, "19");
  // B's 22 (0.8) then 23 (0.9) is a rise after the peak: pooled to 0.85.
  near(at(22).perDay, 0.85, 0.02, "22 pooled");
  near(at(23).perDay, 0.85, 0.02, "23 pooled");
  eq(at(22).bestPlayerId, "B");
  // 20 and 21 have no data: filled from the default, scaled to meet it.
  eq(at(21).source, "default");
  for (let age = at(18).age + 1; age <= 33; age++) {
    const prev = curve.find((p) => p.age === age - 1)!.perDay;
    const cur = curve.find((p) => p.age === age)!.perDay;
    if (cur > prev + 1e-9 && at(age).source === "squad" && at(age - 1).source === "squad") {
      throw new Error(`measured curve rose at ${age}`);
    }
  }
});

check("reference: no history at all gives the default curve", () => {
  const curve = buildReferenceCurve(new Map(), new Map(), TODAY);
  curve.forEach((p) => near(p.perDay, DEFAULT_REFERENCE[p.age], 1e-9, `age ${p.age}`));
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

check("pace: skill shares follow the schedule", () => {
  const entries = history(56, ["passing", "passing", "shooting", "speed"], () => 1);
  const pace = measureBasketballPace(entries, 18, flatCurve(1), TODAY)!;
  near(pace.skillShares.passing, 0.5, 0.03);
  near(pace.skillShares.shooting, 0.25, 0.03);
});

check("camp allowance is capped at the game's 10 days a season", () => {
  // Over a season: two 10-day camps, 70 days apart.
  const entries = history(130, ["passing"], (i) => ((i >= 20 && i < 30) || (i >= 90 && i < 100) ? 2 : 1));
  const pace = measureBasketballPace(entries, 18, flatCurve(1), TODAY)!;
  eq(pace.campDaysPerSeason, CAMP_MAX_DAYS_PER_SEASON);
  eq(pace.campDaysAssumed, false);
});

check("height: steady growth measured; none once it has stopped", () => {
  const growing = history(120, ["passing"], () => 1, { height: (i) => 180 + Math.floor(i / 28) });
  near(measureBasketballPace(growing, 17, flatCurve(1), TODAY)!.heightPerSeason, 4, 0.1);
  const stopped = history(120, ["passing"], () => 1, { height: (i) => (i < 40 ? 180 + i / 10 : 184) });
  eq(measureBasketballPace(stopped, 17, flatCurve(1), TODAY)!.heightPerSeason, 0);
});

// --- Projection ------------------------------------------------------------------

check("points: pace 100% on a flat curve, no camps past 26 = reference x days", () => {
  near(referencePointsBetween(flatCurve(1), 27, 29, 10), 224, 1e-9);
  // Before 26 the camp days add CAMP_DAY_EXTRA each.
  near(referencePointsBetween(flatCurve(1), 20, 21, 10), 122, 1e-9);
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

check("projection: all points land; shooting keeps its share; OR adds up", () => {
  const entries = history(56, ["passing", "technical", "speed", "shooting"], () => 1);
  const pace = measureBasketballPace(entries, 20, flatCurve(1), TODAY)!;
  const now = entries[entries.length - 1].skills;
  const projection = projectBasketball(now, 190, 27, { ...pace, campDaysPerSeason: 0 }, flatCurve(1), 28)!;
  near(projection.points, 112, 1e-6, "points");
  near(projection.skills.shooting - now.shooting, 28, 1, "shooting share");
  const added = SKILLS.reduce((sum, s) => sum + projection.skills[s] - now[s], 0);
  near(added, 112, 1e-3, "every point placed");
  near(projection.overall, basketballOverall(projection.skills), 0);
});

check("projection: height grows at its rate until the stop age, then holds", () => {
  const entries = history(120, ["passing"], () => 1, { height: (i) => 180 + Math.floor(i / 28) });
  const pace = measureBasketballPace(entries, 17, flatCurve(1), TODAY)!;
  const skills = entries[entries.length - 1].skills;
  const projection = projectBasketball(skills, 184, 17, pace, flatCurve(1), 25)!;
  eq(projection.height, Math.floor(184 + pace.heightPerSeason * (HEIGHT_STOP_AGE - 17)));
});

check("potential: at or past the peak age shows the current value", () => {
  const potential = projectBasketballPotential(base(), 200, 90, POTENTIAL_AGE + 1, null, flatCurve(1), {
    rating: 150, ratingWithXp: 177, position: "C",
  });
  eq(potential?.kind, "current");
  eq(potential?.ratingWithXp, 177);
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
