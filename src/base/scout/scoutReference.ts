/**
 * The ELITE and LEAGUE reference lines of the report's growth chart: the best
 * overall rating seen at each age among scouted players, in any sport. Pure
 * functions over the stored snapshots (src/types/ScoutSnapshot.ts). Ages
 * depend on the sport's season length, so every age reading takes it.
 *
 * - ELITE: every snapshot - whoever was best at that age, anywhere.
 * - LEAGUE: only players of the teams in the user's current league.
 *
 * OR only: a roster page shows no skills.
 */

import { smoothFromPeak } from "@/base/smoothFromPeak";
import { LeagueTeams, ScoutSnapshot } from "@/types/ScoutSnapshot";

/** Ages a group's pace reference covers, as the growth models' curves do. */
export const RATE_FIRST_AGE = 15;
export const RATE_LAST_AGE = 34;

export type ScoutPoint = { x: number; y: number; note?: string };

/** A snapshot's age in seasons: whole years plus how far into the season it was taken. */
export function snapshotExactAge(snapshot: ScoutSnapshot, daysPerSeason: number): number | null {
  if (typeof snapshot.age !== "number") return null;
  const day = typeof snapshot.seasonDay === "number" ? snapshot.seasonDay : 0;
  return snapshot.age + Math.min(Math.max(day, 0), daysPerSeason) / daysPerSeason;
}

/**
 * For each whole age, the highest OR among all snapshots taken at that age,
 * placed at that snapshot's exact age and labelled with whose it was. A player
 * seen at 19 and again at 20 counts at both.
 */
export function bestOrByAge(snapshots: ScoutSnapshot[], daysPerSeason: number): ScoutPoint[] {
  const best = new Map<number, ScoutSnapshot>();
  snapshots.forEach((snapshot) => {
    if (typeof snapshot.age !== "number" || typeof snapshot.overallRating !== "number") return;
    const held = best.get(snapshot.age);
    if (!held || snapshot.overallRating > held.overallRating!) best.set(snapshot.age, snapshot);
  });

  return [...best.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, snapshot]) => ({
      x: snapshotExactAge(snapshot, daysPerSeason)!,
      y: snapshot.overallRating!,
      note: [snapshot.name, snapshot.teamName].filter(Boolean).join(", ") || undefined,
    }));
}

/** The snapshots of players who were on one of the league's teams when seen. */
export function leagueSnapshots(snapshots: ScoutSnapshot[], league: LeagueTeams | null): ScoutSnapshot[] {
  if (!league) return [];
  const teamIds = new Set(league.teamIds);
  return snapshots.filter((snapshot) => snapshot.teamId !== undefined && teamIds.has(snapshot.teamId));
}

/** How many distinct players and teams a set of snapshots covers. */
export function scoutCoverage(snapshots: ScoutSnapshot[]): { players: number; teams: number } {
  const players = new Set<string>();
  const teams = new Set<string>();
  snapshots.forEach((snapshot) => {
    players.add(snapshot.playerId);
    if (snapshot.teamId) teams.add(snapshot.teamId);
  });
  return { players: players.size, teams: teams.size };
}

/**
 * Whether the league list predates the newest snapshot's season - the league
 * may have changed since (promotion, relegation), so the LEAGUE line could be
 * filtering by last season's teams.
 */
export function isLeagueStale(league: LeagueTeams | null, snapshots: ScoutSnapshot[]): boolean {
  if (!league) return false;
  return snapshots.some((snapshot) => typeof snapshot.season === "number" && snapshot.season > league.season);
}

export interface ScoutReferences {
  elite: { points: ScoutPoint[]; caption: string };
  league: { points: ScoutPoint[]; caption: string };
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** Both lines with the caption that says what each is built from. */
export function buildScoutReferences(
  snapshots: ScoutSnapshot[],
  league: LeagueTeams | null,
  daysPerSeason: number
): ScoutReferences {
  const all = scoutCoverage(snapshots);
  const inLeague = leagueSnapshots(snapshots, league);
  const leagueCoverage = scoutCoverage(inLeague);

  const eliteCaption =
    snapshots.length === 0
      ? "Elite: nothing scouted yet - open other teams' Players pages in the game"
      : `Elite: best OR at each age among ${plural(all.players, "player")} from ${plural(all.teams, "team")}`;

  let leagueCaption: string;
  if (!league) {
    leagueCaption = "League: open your league standings in the game to set your league";
  } else {
    leagueCaption =
      `League ${league.leagueName}, season ${league.season}: best OR at each age among ` +
      `${plural(leagueCoverage.players, "player")} from ${leagueCoverage.teams} of ` +
      `${plural(league.teamIds.length, "team")}`;
    if (isLeagueStale(league, snapshots)) {
      leagueCaption += " - the league list is from an earlier season; reopen your league standings";
    }
  }

  return {
    elite: { points: bestOrByAge(snapshots, daysPerSeason), caption: eliteCaption },
    league: { points: bestOrByAge(inLeague, daysPerSeason), caption: leagueCaption },
  };
}

// --- The table: level and pace against a group -------------------------------------

/** How far past a line's first or last point (in seasons) its end value still stands. */
const LEVEL_EDGE_SLACK = 0.5;

/**
 * A group's best OR at an exact age: linear between the line's points, the end
 * value just past either end, null beyond that - the group has nobody of that
 * age to compare with. `note` is whose value the nearer point is.
 */
export function bestOrAt(points: ScoutPoint[], exactAge: number): { value: number; note?: string } | null {
  if (points.length === 0) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (exactAge < first.x - LEVEL_EDGE_SLACK || exactAge > last.x + LEVEL_EDGE_SLACK) return null;
  if (exactAge <= first.x) return { value: first.y, note: first.note };
  if (exactAge >= last.x) return { value: last.y, note: last.note };

  const after = points.findIndex((point) => point.x >= exactAge);
  const left = points[after - 1];
  const right = points[after];
  const share = right.x > left.x ? (exactAge - left.x) / (right.x - left.x) : 0;
  return {
    value: left.y + (right.y - left.y) * share,
    note: (share < 0.5 ? left : right).note,
  };
}

/**
 * A pair needs this long between its two snapshots: each whole-number OR can
 * sit several points below the true sum of the skills, so a short pair's rate
 * is mostly rounding.
 */
export const RATE_MIN_DAYS = 42;
/** ...and no longer than a season and a half, so it is still "recent". */
export const RATE_MAX_DAYS = 105;
/** A group's pace reference isn't used until it rests on this many players. */
export const RATE_MIN_PAIRS = 10;
/** 100% at an age is the mean of this many fastest players - one alone is the luckiest rounding. */
export const RATE_TOP = 3;

const DAY_MS = 86_400_000;
const daysApart = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

export interface ScoutRate {
  playerId: string;
  name?: string;
  teamId?: string;
  teamName?: string;
  /** OR gained per calendar day - camp and no-training days included. */
  perDay: number;
  days: number;
  /** Whole age at the middle of the pair. */
  age: number;
}

/**
 * One growth rate per player seen twice: the latest snapshot against the
 * earliest one RATE_MIN_DAYS..RATE_MAX_DAYS before it on the same team (a
 * transfer changes the training, so a pair across one says nothing).
 */
export function scoutRatePairs(snapshots: ScoutSnapshot[], daysPerSeason: number): ScoutRate[] {
  const byPlayer = new Map<string, ScoutSnapshot[]>();
  snapshots.forEach((snapshot) => {
    if (typeof snapshot.age !== "number" || typeof snapshot.overallRating !== "number") return;
    const list = byPlayer.get(snapshot.playerId);
    if (list) list.push(snapshot);
    else byPlayer.set(snapshot.playerId, [snapshot]);
  });

  const rates: ScoutRate[] = [];
  byPlayer.forEach((list, playerId) => {
    list.sort((a, b) => a.date.localeCompare(b.date));
    const last = list[list.length - 1];
    const first = list.find((snapshot) => {
      const days = daysApart(snapshot.date, last.date);
      return days >= RATE_MIN_DAYS && days <= RATE_MAX_DAYS && snapshot.teamId === last.teamId;
    });
    if (!first) return;
    const days = daysApart(first.date, last.date);
    const midAge =
      (snapshotExactAge(first, daysPerSeason)! + snapshotExactAge(last, daysPerSeason)!) / 2;
    rates.push({
      playerId,
      name: last.name,
      teamId: last.teamId,
      teamName: last.teamName,
      perDay: (last.overallRating! - first.overallRating!) / days,
      days,
      age: Math.floor(midAge),
    });
  });
  return rates;
}

/**
 * How many of the rates are other teams' players. The ready rule counts only
 * these: the user's own squad is snapshotted on every overview visit, so it
 * alone would reach RATE_MIN_PAIRS within weeks and "pace vs Elite" would be
 * the squad measured against itself.
 */
export function scoutedPairCount(rates: ScoutRate[], ownTeamId: string | undefined): number {
  return rates.filter((rate) => rate.teamId === undefined || rate.teamId !== ownTeamId).length;
}

export interface GroupRatePoint {
  age: number;
  /** OR per calendar day that counts as 100% at this age. */
  perDay: number;
  /** "measured" from pairs at this age; "filled" from the sport's own age curve. */
  source: "measured" | "filled";
  /** The players behind a measured age's 100%, fastest first. */
  top: ScoutRate[];
}

/**
 * A group's pace reference by age: the mean of the RATE_TOP fastest players at
 * each age, made non-increasing after the peak like the squad curve. Ages
 * nobody was measured at take `shape` - the sport's own age curve, any unit -
 * scaled to meet the nearest measured age. Empty when there are no pairs.
 */
export function groupRateByAge(rates: ScoutRate[], shape: (age: number) => number): GroupRatePoint[] {
  const byAge = new Map<number, ScoutRate[]>();
  rates.forEach((rate) => {
    if (rate.age < RATE_FIRST_AGE || rate.age > RATE_LAST_AGE) return;
    const list = byAge.get(rate.age);
    if (list) list.push(rate);
    else byAge.set(rate.age, [rate]);
  });
  if (byAge.size === 0) return [];

  const top = new Map<number, ScoutRate[]>();
  const means = new Map<number, number>();
  byAge.forEach((list, age) => {
    const fastest = [...list].sort((a, b) => b.perDay - a.perDay).slice(0, RATE_TOP);
    top.set(age, fastest);
    means.set(age, fastest.reduce((sum, rate) => sum + rate.perDay, 0) / fastest.length);
  });
  const smoothed = smoothFromPeak(means);
  const measuredAges = [...smoothed.keys()];
  const shapeAt = (age: number) => Math.max(0, shape(age) || 0);

  const curve: GroupRatePoint[] = [];
  for (let age = RATE_FIRST_AGE; age <= RATE_LAST_AGE; age++) {
    const measured = smoothed.get(age);
    if (measured !== undefined) {
      curve.push({ age, perDay: measured, source: "measured", top: top.get(age)! });
      continue;
    }
    const nearest = measuredAges.reduce((found, candidate) =>
      Math.abs(candidate - age) < Math.abs(found - age) ? candidate : found
    );
    const scale = shapeAt(nearest) > 0 ? smoothed.get(nearest)! / shapeAt(nearest) : 0;
    curve.push({ age, perDay: shapeAt(age) * scale, source: "filled", top: [] });
  }
  return curve;
}

/** How long a player's own OR window is, and the least it may span. */
export const OWN_RATE_WINDOW_DAYS = 56;
export const OWN_RATE_MIN_DAYS = 28;

export interface OwnRate {
  perDay: number;
  days: number;
  fromDate: string;
  toDate: string;
}

/**
 * A player's own OR gained per calendar day over his last OWN_RATE_WINDOW_DAYS
 * of history - measured the way a scouted pair is (two ORs, calendar days), so
 * it can be set against a group's rate like for like. Null under
 * OWN_RATE_MIN_DAYS of span.
 */
export function ownOrRate(days: { date: string; or: number }[]): OwnRate | null {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;
  const last = sorted[sorted.length - 1];
  const first = sorted.find((day) => daysApart(day.date, last.date) <= OWN_RATE_WINDOW_DAYS)!;
  const span = daysApart(first.date, last.date);
  if (span < OWN_RATE_MIN_DAYS) return null;
  return { perDay: (last.or - first.or) / span, days: span, fromDate: first.date, toDate: last.date };
}

// --- The squad's own line ----------------------------------------------------------

/** How far from a whole-age birthday a stored day may be to count for it. */
const SQUAD_AGE_TOLERANCE_DAYS = 7;

/**
 * "Your squad's best OR at each age": for every whole age, the highest OR any
 * player had on the day they reached it, from the stored history. Sampled at
 * the birthday rather than as a max over the year, so each point means "at
 * age N". The level counterpart of the scouted lines, for the Squad choice.
 */
export function squadBestOrByAge<E extends { date: string }>(
  historyByPlayer: Map<string, E[]>,
  exactAgeByPlayer: Map<string, number>,
  daysPerSeason: number,
  readOr: (entry: E) => number | null,
  nameByPlayer: Map<string, string> = new Map(),
  today: number = Date.now()
): ScoutPoint[] {
  const best = new Map<number, { or: number; playerId: string }>();

  historyByPlayer.forEach((entries, playerId) => {
    const exactAge = exactAgeByPlayer.get(playerId);
    if (exactAge === undefined) return;

    const nearest = new Map<number, { or: number; distance: number }>();
    entries.forEach((entry) => {
      const or = readOr(entry);
      if (or === null) return;
      const daysAgo = (today - Date.parse(`${entry.date}T00:00:00`)) / DAY_MS;
      const age = exactAge - daysAgo / daysPerSeason;
      const whole = Math.round(age);
      const distance = Math.abs(age - whole) * daysPerSeason;
      if (distance > SQUAD_AGE_TOLERANCE_DAYS) return;
      const held = nearest.get(whole);
      if (!held || distance < held.distance) nearest.set(whole, { or, distance });
    });

    nearest.forEach(({ or }, age) => {
      if (or > (best.get(age)?.or ?? -Infinity)) best.set(age, { or, playerId });
    });
  });

  return [...best.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([age, { or, playerId }]) => ({ x: age, y: or, note: nameByPlayer.get(playerId) }));
}

/**
 * Only the players who were ever on the user's team: those with a day from
 * the squad overview or the training-progress page (or a legacy day without a
 * source - those all came from the training page). A profile visit stores an
 * opponent's day too, and without this an opponent seen near a birthday would
 * become "your squad's best".
 */
export function squadHistoryOnly<E extends { source?: string }>(
  historyByPlayer: Map<string, E[]>
): Map<string, E[]> {
  return new Map(
    [...historyByPlayer].filter(([, entries]) =>
      entries.some((entry) => entry.source === undefined || entry.source !== "PlayerProfile")
    )
  );
}
