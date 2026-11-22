/**
 * Assertions for the OR view's pace and projection - src/base/orGrowth.ts and
 * its hockey, soccer and basketball bindings - plus the OR datasets the three
 * profile charts draw (src/components/growthMetric.ts). See test/README.md for
 * how to run these.
 *
 * The cases that matter most: an unscouted player's OR-only history gets a
 * pace and a projection, and a player at 100% of the top-5% OR line's
 * smoothed rate projects along it.
 */

import { OR_BASIS_AFTER_DAYS, measureOrGain } from "@/base/orGrowth";
import { orReferenceTable, smoothedOrSeasonGains } from "@/base/relativeSkillFit";
import { orProjectionDataset, orReferenceDataset } from "@/components/growthMetric";
import * as hockey from "@/sports/hockey/growthPace";
import * as soccer from "@/sports/soccer/growthPace";
import {
  relativeOrReference as hockeyOrLine,
  relativeSkillFit as hockeyFit,
} from "@/sports/hockey/relativeSkillReference";
import { relativeOrReference as soccerOrLine } from "@/sports/soccer/relativeSkillReference";
import {
  relativeOrReference as basketballOrLine,
  relativeSkillFit as basketballFit,
} from "@/sports/basketball/relativeSkillReference";
import {
  BASKETBALL_REFERENCE_CURVE,
  OR_SMOOTHED_SEASON_GAINS,
  basketballOrModel,
  measureBasketballPace,
} from "@/sports/basketball/growthModel";
import { BasketballSkills } from "@/sports/basketball/classes/BasketballPlayer";
import { HockeySkills } from "@/sports/hockey/classes/HockeyPlayer";

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
const near = (a: number | null | undefined, b: number, m = "", tolerance = 1e-6) => {
  if (a === null || a === undefined || Math.abs(a - b) > tolerance) {
    throw new Error(`${m} expected ~${b}, got ${a}`);
  }
};
const ok = (condition: boolean, m: string) => {
  if (!condition) throw new Error(m);
};

// Ages measure back from Date.now(): pin it.
const TODAY = Date.parse("2026-11-22T12:00:00Z");
Date.now = () => TODAY;
const iso = (daysAgo: number) => new Date(TODAY - daysAgo * 86_400_000).toISOString().slice(0, 10);

const HOCKEY_SKILLS = hockey.hockeyGrowthConfig.skillNames;
const hockeySkills = (value: number): HockeySkills =>
  Object.fromEntries(HOCKEY_SKILLS.map((skill) => [skill, value])) as HockeySkills;

/**
 * A hockey history of `days` daily decimal days ending today, every skill
 * gaining `perSkillPerDay`; camp days (by index) gain double.
 */
function skilledHistory(days: number, perSkillPerDay: number, campDays: number[] = []) {
  let value = 50.25;
  return Array.from({ length: days + 1 }, (_, i) => {
    if (i > 0) value += perSkillPerDay * (campDays.includes(i) ? 2 : 1);
    return { date: iso(days - i), source: "TrainingProgress", skills: hockeySkills(value) };
  });
}

/** OR-only profile visits: [days ago, OR] - an unscouted player. */
const orVisits = (visits: [number, number][]) =>
  visits.map(([ago, or]) => ({ date: iso(ago), source: "PlayerProfile", overallRating: or }));

const OPTIONS = {
  skillNames: HOCKEY_SKILLS,
  daysPerSeason: 112,
  pace: { windowDays: 56, minSpanDays: 28, provisionalMinDays: 14 },
  camps: { maxDaysPerSeason: 14, lookbackDays: 112 },
};

// --- The OR line ---------------------------------------------------------------

check("the OR line is the fit's OR percentile, per sport, generated beside the rating line", () => {
  eq(hockeyOrLine, hockeyFit.rows.map((row) => ({ age: row.age, or: row.or })), "hockey");
  eq(basketballOrLine, orReferenceTable(basketballFit), "basketball");
  eq(soccerOrLine.length > 0 && soccerOrLine[0].age, 15, "soccer starts at 15");
});

check("the OR line's smoothed gains rise to one peak and then fall", () => {
  const gains = smoothedOrSeasonGains(hockeyOrLine);
  const values = hockeyOrLine.slice(0, -1).map((row) => gains[row.age]);
  const peak = values.indexOf(Math.max(...values));
  ok(values.slice(0, peak + 1).every((v, i, a) => i === 0 || v >= a[i - 1]), `rises: ${values}`);
  ok(values.slice(peak).every((v, i, a) => i === 0 || v <= a[i - 1]), `then falls: ${values}`);
  eq(hockey.orExpectedSeasonGain(18.5), gains[18], "hockey's OR model reads them");
});

// --- Measuring OR growth -------------------------------------------------------

check("on skills: every skill's points per season, the skill pace's window", () => {
  const gain = measureOrGain(skilledHistory(70, 0.25), OPTIONS)!;
  eq(gain.basis, "skills");
  eq(gain.fromDate, iso(56), "the 56-day window");
  near(gain.perSeason, 7 * 0.25 * 112, "7 skills x 0.25 a day x 112", 1e-6);
  eq(gain.provisional, false);
});

check("on skills: a camp run is skipped from the rate and counted for the allowance", () => {
  // Days 60-64 of 70 at double gain: a 5-day camp inside the window.
  const gain = measureOrGain(skilledHistory(70, 0.25, [60, 61, 62, 63, 64]), OPTIONS)!;
  eq(gain.skippedCampDays, 5, "camp skipped");
  near(gain.perSeason, 7 * 0.25 * 112, "rate is the normal days'", 1e-6);
  // Under a season of history: the full allowance is assumed.
  eq(gain.campDaysPerSeason, 14);
  eq(gain.campDaysAssumed, true);
});

check("OR-only history (an unscouted player): measured end to end on the OR numbers", () => {
  const gain = measureOrGain(orVisits([[90, 500], [42, 560], [21, 590], [0, 620]]), OPTIONS)!;
  eq(gain.basis, "or");
  eq(gain.fromDate, iso(42), "the window starts at the first visit within 56 days");
  near(gain.perSeason, (60 / 42) * 112, "60 OR in 42 days");
  eq(gain.campDaysPerSeason, 0, "no allowance on top: the calendar rate includes camps");
  eq(gain.provisional, false);
});

check("OR-only history: 14-27 days is provisional, under 14 no pace", () => {
  eq(measureOrGain(orVisits([[20, 600], [0, 630]]), OPTIONS)!.provisional, true, "20 days");
  eq(measureOrGain(orVisits([[10, 600], [0, 610]]), OPTIONS), null, "10 days");
  eq(measureOrGain(orVisits([[0, 600]]), OPTIONS), null, "one visit");
});

check("skills and OR-only days mixed: skills while the skilled window is fresh", () => {
  eq(OR_BASIS_AFTER_DAYS, 30, "a month");
  // Scouted until 30 days ago, then only seen on his profile: the skill
  // window still stands, so a profile visit doesn't decide the basis.
  const skilled = skilledHistory(60, 0.25).filter((_, i) => i <= 30);
  const later = orVisits([[20, 900], [0, 950]]);
  const mixed = measureOrGain([...skilled, ...later], OPTIONS)!;
  eq(mixed.basis, "skills", "newer OR-only days don't switch the basis");
  eq(mixed.toDate, iso(30), "the window ends at the last skilled day");
  near(mixed.perSeason, measureOrGain(skilled, OPTIONS)!.perSeason, "same as without them");
  // Too few skilled days for a window: the OR numbers.
  const oneSkilled = [skilledHistory(60, 0.25)[0], ...later];
  eq(measureOrGain(oneSkilled, OPTIONS)!.basis, "or", "no skilled window");
});

check("skills and OR-only days mixed: a stale skilled window gives way to recent OR numbers", () => {
  // A sold player: trained here until 45 days ago, seen on his profile since.
  const skilled = skilledHistory(90, 0.25).filter((_, i) => i <= 45);
  const later = orVisits([[28, 900], [0, 935]]);
  const sold = measureOrGain([...skilled, ...later], OPTIONS)!;
  eq(sold.basis, "or", "45 days older than the newest OR-only day");
  eq([sold.fromDate, sold.toDate], [iso(56), iso(0)], "the OR window: 56 days back from today, skilled days' OR included");
  // 31 days is past the limit, 30 is not.
  const at = (gap: number) =>
    measureOrGain([...skilledHistory(60 + gap, 0.25).filter((_, i) => i <= 60), ...orVisits([[0, 950]])], OPTIONS)!.basis;
  eq(at(30), "skills", "30 days");
  eq(at(31), "or", "31 days");
  // Stale, but nothing else within the OR window (last skilled day 60 days ago,
  // one visit today): the skilled window still counts.
  const lone = [...skilledHistory(120, 0.25).filter((_, i) => i <= 60), ...orVisits([[0, 950]])];
  eq(measureOrGain(lone, OPTIONS)!.basis, "skills", "no measurable OR window");
});

// --- Hockey and soccer: pace and projection -------------------------------------

check("hockey OR pace: OR per season / the OR line's smoothed gain at the window's middle", () => {
  // Visits from 18.0 to 18.5 (56 days, 112-day seasons).
  const age = 18.5;
  const expected = hockey.orExpectedSeasonGain(18.25)!;
  const perSeason = 0.8 * expected;
  const pace = hockey.measureOrPace(orVisits([[56, 1000], [0, 1000 + (perSeason * 56) / 112]]), age)!;
  near(pace.midAge, 18.25, "mid age", 0.01);
  near(pace.pace, 0.8, "pace", 0.01);
});

check("hockey: a player at 100% of the OR line's rate projects along that rate", () => {
  const gains = smoothedOrSeasonGains(hockeyOrLine);
  const expected = hockey.orExpectedSeasonGain(18.25)!;
  const pace = hockey.measureOrPace(orVisits([[56, 1000], [0, 1000 + expected / 2]]), 18.5)!;
  near(pace.pace, 1, "100%", 1e-9);
  // From 18.5 to 21: half of 18's gain, then 19 and 20 in full (factor 1 to 21, no camps).
  const projected = hockey.projectOr(1100, 18.5, pace, 21)!;
  near(projected, 1100 + gains[18] / 2 + gains[19] + gains[20], "on the rate", 1e-6);
});

check("hockey: the OR projection applies the OR age factors (divided out, then each year's)", () => {
  // A 23-year-old at 66% (the 22-24 band, factor 0.94) projects as 70% / 0.94 x each year's factor.
  const age = 23.5;
  const expected = hockey.orExpectedSeasonGain(23.25)!;
  const pace = hockey.measureOrPace(orVisits([[56, 2000], [0, 2000 + (0.66 * expected) / 2]]), age)!;
  near(pace.pace, 0.66, "measured", 1e-9);
  const gains = smoothedOrSeasonGains(hockeyOrLine);
  const underlying = 0.66 / hockey.orAgePaceFactor(23.25);
  const want = 2000 + underlying * (gains[23] * 0.5 * 0.94 + gains[24] * 0.94 + gains[25] * 0.94);
  near(hockey.projectOr(2000, age, pace, 26), want, "23.5 -> 26", 1e-6);
  eq(hockey.OR_AGE_PACE_FACTORS.map((band) => band.factor), [1, 0.94, 0.94, 0.78], "factors");
});

check("hockey: the chart points start at today's OR, rise, stop at 35; none without a pace or OR", () => {
  const pace = hockey.measureOrPace(orVisits([[42, 640], [0, 715]]), 17.4)!;
  const points = hockey.orProjectionPoints(715, 17.4, pace, 45);
  eq(points[0], { x: 17.4, y: 715 }, "starts at now");
  eq(points[1].x, 18, "then whole ages");
  eq(points[points.length - 1].x, 35, "stops at the max age");
  ok(points.every((p, i) => i === 0 || p.y >= points[i - 1].y), "never falls");
  eq(hockey.orProjectionPoints(undefined, 17.4, pace, 45), [], "no OR");
  eq(hockey.orProjectionPoints(0, 17.4, pace, 45), [], "OR 0");
  eq(hockey.orProjectionPoints(715, 17.4, null, 45), [], "no pace");
});

check("soccer: the OR line's rate to 23 (juniors corrected), the squad's decline scaled to it from 24", () => {
  const gains = smoothedOrSeasonGains(soccerOrLine);
  eq(soccer.orExpectedSeasonGain(20.5), gains[20], "20: the line's smoothed rate");
  eq(soccer.orExpectedSeasonGain(25.5), Math.round(soccer.SQUAD_SLOPE_SHARE_FROM_24[25] * gains[23]), "25");
  eq(soccer.orExpectedSeasonGain(34.5), null, "34: the squad stops gaining");
  near(soccer.orExpectedSeasonGain(15.5), gains[15] * 1.35, "15: the junior correction, 1.35");
  near(soccer.orExpectedSeasonGain(16.5), gains[16] * 1.23, "16: 1.23");
  eq(soccer.OR_AGE_PACE_FACTORS.map((band) => band.factor), [1, 1, 1], "the factors are 1: it's in the rate");
});

// --- Basketball ----------------------------------------------------------------

const BASKETBALL_SKILLS: (keyof BasketballSkills)[] = [
  "shooting", "blocking", "passing", "technical", "speed", "aggression", "jumping",
];

check("basketball: OR pace on the skill pace's window, against the top-5% OR line", () => {
  const skills = Object.fromEntries(BASKETBALL_SKILLS.map((s) => [s, 50.5])) as BasketballSkills;
  const entries = Array.from({ length: 41 }, (_, i) => {
    const skill = BASKETBALL_SKILLS[i % BASKETBALL_SKILLS.length];
    if (i > 0) skills[skill] += 0.9;
    return { playerId: "1", date: iso(41 - i), skills: { ...skills }, height: 200 };
  });
  const model = basketballOrModel(TODAY);
  const skillPace = measureBasketballPace(entries, 20, BASKETBALL_REFERENCE_CURVE, TODAY)!;
  const orPace = model.measureOrPace(entries, 20)!;
  eq([orPace.fromDate, orPace.toDate], [skillPace.fromDate, skillPace.toDate], "same window");
  eq(orPace.campDaysPerSeason, skillPace.campDaysPerSeason, "same camp record");
  near(orPace.pace, (0.9 * 70) / OR_SMOOTHED_SEASON_GAINS[Math.floor(orPace.midAge)], "OR a season / the OR line's", 1e-9);
  // A profile visit a day after the last skilled day: the window is fresh, so
  // both still read it (OR_BASIS_AFTER_DAYS).
  const withVisit = [...entries, { playerId: "1", date: iso(0), overallRating: 900 }];
  near(model.measureOrPace(withVisit, 20)!.pace, orPace.pace!, "with a newer OR-only day", 1e-9);
});

check("basketball: an unscouted player's OR-only visits get a pace and a projection", () => {
  const model = basketballOrModel(TODAY);
  const rate = OR_SMOOTHED_SEASON_GAINS[19];
  // Exactly the line's rate at 19 over 35 days (19.4 to 19.9): 100%.
  const pace = model.measureOrPace(orVisits([[35, 800], [0, 800 + (rate * 35) / 70]]), 19.9)!;
  eq(pace.basis, "or");
  near(pace.pace, 1, "100%", 1e-9);
  // To 21 at factor 1.00, no camp allowance on the OR basis.
  near(model.projectOr(835, 19.9, pace, 21), 835 + rate * 0.1 + OR_SMOOTHED_SEASON_GAINS[20], "on the line's rate", 1e-6);
  const points = model.orProjectionPoints(835, 19.9, pace, 45);
  eq(points[0], { x: 19.9, y: 835 }, "starts at now");
  eq(points[points.length - 1].x, 35, "stops after the reference's last age");
});

// --- Chart datasets -------------------------------------------------------------

check("the OR datasets: a grey Top 5% (OR) line and a dashed projection with the pace in the legend", () => {
  const line = orReferenceDataset(hockeyOrLine);
  eq(line.label, "Top 5% (OR)");
  eq((line.data as { x: number; y: number }[])[0], { x: 15, y: hockeyOrLine[0].or });
  const points = [{ x: 17.4, y: 715 }, { x: 18, y: 800 }];
  eq(orProjectionDataset(points, { value: 0.954, provisional: false })!.label, "Projected at own pace (OR, 95%)");
  eq(
    orProjectionDataset(points, { value: 0.61, provisional: true })!.label,
    "Projected at own pace (OR, ~61%, provisional)"
  );
  eq(orProjectionDataset(points, { value: 0.61, provisional: true })!.borderDash, [6, 4], "dashed");
  eq(orProjectionDataset([], { value: 0.61, provisional: false }), null, "no points");
  eq(orProjectionDataset(points, null), null, "no pace");
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
if (failures > 0) process.exitCode = 1;
