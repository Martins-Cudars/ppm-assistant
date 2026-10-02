/**
 * The ELITE and LEAGUE reference lines of the report's growth chart: the best
 * overall rating seen at each age among scouted players. Pure functions over
 * the stored snapshots (src/types/ScoutSnapshot.ts).
 *
 * - ELITE: every snapshot - whoever was best at that age, anywhere.
 * - LEAGUE: only players of the teams in the user's current league.
 *
 * OR only: a roster page shows no skills.
 */

import { basketballPlayerProfile } from "@/sports/basketball/playerProfile";
import { LeagueTeams, ScoutSnapshot } from "@/types/ScoutSnapshot";

export type ScoutPoint = { x: number; y: number; note?: string };

/** A snapshot's age in seasons: whole years plus how far into the season it was taken. */
export function snapshotExactAge(
  snapshot: ScoutSnapshot,
  daysPerSeason: number = basketballPlayerProfile.daysPerSeason
): number | null {
  if (typeof snapshot.age !== "number") return null;
  const day = typeof snapshot.seasonDay === "number" ? snapshot.seasonDay : 0;
  return snapshot.age + Math.min(Math.max(day, 0), daysPerSeason) / daysPerSeason;
}

/**
 * For each whole age, the highest OR among all snapshots taken at that age,
 * placed at that snapshot's exact age and labelled with whose it was. A player
 * seen at 19 and again at 20 counts at both.
 */
export function bestOrByAge(
  snapshots: ScoutSnapshot[],
  daysPerSeason: number = basketballPlayerProfile.daysPerSeason
): ScoutPoint[] {
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
  league: LeagueTeams | null
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
    elite: { points: bestOrByAge(snapshots), caption: eliteCaption },
    league: { points: bestOrByAge(inLeague), caption: leagueCaption },
  };
}
