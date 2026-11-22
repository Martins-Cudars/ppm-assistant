/**
 * The league half of relative skill ("87% / 95%"): the 100% line of the
 * viewer's own league, fitted at runtime from his scouted snapshots of the
 * teams in his stored league list, against the sport's static global line
 * (src/sports/<sport>/relativeSkillReference.ts) with the same code the
 * script uses (src/base/relativeSkillFit.ts).
 *
 * - Fitted once per page and sport, on first use; the result is reactive, so
 *   Vue components re-render when it arrives. DOM renderers wait for
 *   `whenLeagueReference`.
 * - Sparse ages lean on the league's ratio trend (fitLeagueOr). With no
 *   league list, under MIN_LEAGUE_POINTS player-seasons or under
 *   MIN_LEAGUE_AGES measured ages there is no league line: null, and only the
 *   global value is shown.
 */

import { shallowReactive } from "vue";
import {
  RelativeSkillFit,
  agesBetween,
  fitLeagueOr,
  referenceTable,
  scoutPoints,
} from "@/base/relativeSkillFit";
import { exportScoutSnapshots, readLeagueTeams } from "@/storage/scoutSnapshotDb";
import { GrowthPrediction } from "@/types/GrowthData";
import { ScoutSnapshot } from "@/types/ScoutSnapshot";
import { Sport } from "@/types/Sport";

/** The league table from a sport's snapshots and league teams, or null when too sparse. */
export function fitLeagueReference(
  fit: RelativeSkillFit,
  snapshots: readonly ScoutSnapshot[],
  leagueTeamIds: readonly string[],
  daysPerSeason: number
): GrowthPrediction | null {
  if (fit.rows.length === 0 || leagueTeamIds.length === 0) return null;
  const teams = new Set(leagueTeamIds);
  const ages = agesBetween(fit.rows[0].age, fit.rows[fit.rows.length - 1].age);
  const points = scoutPoints(snapshots, daysPerSeason, (row) => row.teamId !== undefined && teams.has(row.teamId));
  const league = fitLeagueOr(points, ages, fit.percentile, fit.rows.map((row) => row.or));
  return league ? referenceTable(fit, league.curve) : null;
}

const tables = shallowReactive(new Map<Sport, GrowthPrediction | null>());
const pending = new Map<Sport, Promise<GrowthPrediction | null>>();

async function load(sport: Sport, fit: RelativeSkillFit, daysPerSeason: number) {
  let table: GrowthPrediction | null = null;
  try {
    const [league, snapshots] = await Promise.all([readLeagueTeams(sport), exportScoutSnapshots(sport)]);
    if (league && snapshots) table = fitLeagueReference(fit, snapshots, league.teamIds, daysPerSeason);
  } catch (error) {
    console.error("[LeagueRelativeSkill] Failed to fit the league line:", error);
  }
  tables.set(sport, table);
  return table;
}

/** Starts the sport's fit once (outside the extension, e.g. in checks, it settles at null). */
function ensure(sport: Sport, fit: RelativeSkillFit, daysPerSeason: number) {
  let promise = pending.get(sport);
  if (!promise) {
    promise =
      typeof chrome !== "undefined" && chrome.runtime?.id !== undefined
        ? load(sport, fit, daysPerSeason)
        : Promise.resolve(null);
    pending.set(sport, promise);
  }
  return promise;
}

/**
 * The league table if fitted, else null - also while it is still loading.
 * Reactive: a component that read null re-renders once it arrives.
 */
export function leagueReference(
  sport: Sport,
  fit: RelativeSkillFit,
  daysPerSeason: number
): GrowthPrediction | null {
  void ensure(sport, fit, daysPerSeason);
  return tables.get(sport) ?? null;
}

/** Settles once the sport's league line is fitted (or known to be missing). */
export function whenLeagueReference(
  sport: Sport,
  fit: RelativeSkillFit,
  daysPerSeason: number
): Promise<GrowthPrediction | null> {
  return ensure(sport, fit, daysPerSeason);
}

/** For a static harness or a check: sets a sport's league table without the extension. */
export function setLeagueReference(sport: Sport, table: GrowthPrediction | null): void {
  pending.set(sport, Promise.resolve(table));
  tables.set(sport, table);
}
