/**
 * The league half of relative skill, worked out in the background worker:
 * it owns the scout snapshots, so it fits the viewer's league line next to
 * them and sends a page only the fitted table (about 30 rows), not the store.
 * The fitting is src/base/relativeSkillFit.ts, shared with the script.
 *
 * The league list is read first: with no list, an empty one or one from an
 * earlier season than the page's, the snapshots are never read. A fitted
 * table is cached per sport, keyed on the list (league, season, teams) and
 * the store's version (its count plus a counter the worker bumps on every
 * write), so a page load after the first costs one count.
 */

import {
  MIN_LEAGUE_AGES,
  MIN_LEAGUE_POINTS,
  RelativeSkillFit,
  fitLeagueReference,
  isLeagueListCurrent,
} from "@/base/relativeSkillFit";
import type { LeagueLineStatus } from "@/base/relativeSkill";
import { hockeyPlayerProfile } from "@/sports/hockey/playerProfile";
import { soccerPlayerProfile } from "@/sports/soccer/playerProfile";
import { basketballPlayerProfile } from "@/sports/basketball/playerProfile";
import { GrowthPrediction } from "@/types/GrowthData";
import { LeagueTeams, ScoutSnapshot } from "@/types/ScoutSnapshot";
import { Sport } from "@/types/Sport";

/** The league table, or null with the reason the page's tooltip gives. */
export type LeagueReferenceResult = { table: GrowthPrediction | null; status: LeagueLineStatus };

/** What the fit reads, injected so a check can run it without the worker. */
export type LeagueReferenceSources = {
  readLeague: () => Promise<LeagueTeams | null>;
  /** Changes whenever the sport's snapshots change. */
  snapshotVersion: () => Promise<string>;
  readSnapshots: () => Promise<ScoutSnapshot[]>;
};

export const LEAGUE_FIT_SETTINGS: Record<Sport, { fit: RelativeSkillFit; daysPerSeason: number }> = {
  hockey: { fit: hockeyPlayerProfile.relativeSkillFit, daysPerSeason: hockeyPlayerProfile.daysPerSeason },
  soccer: { fit: soccerPlayerProfile.relativeSkillFit, daysPerSeason: soccerPlayerProfile.daysPerSeason },
  basketball: {
    fit: basketballPlayerProfile.relativeSkillFit,
    daysPerSeason: basketballPlayerProfile.daysPerSeason,
  },
};

/** A per-sport cache around the fit; one per worker. */
export function createLeagueReferenceFitter(settings = LEAGUE_FIT_SETTINGS) {
  const cache = new Map<Sport, { key: string; result: LeagueReferenceResult }>();

  return async function leagueReference(
    sport: Sport,
    currentSeason: number | null,
    sources: LeagueReferenceSources
  ): Promise<LeagueReferenceResult> {
    const league = await sources.readLeague();
    if (!league || league.teamIds.length === 0) return { table: null, status: { kind: "no-league" } };
    if (!isLeagueListCurrent(league, currentSeason)) {
      return { table: null, status: { kind: "stale", listSeason: league.season, currentSeason: currentSeason! } };
    }

    const key = `${league.leagueId}:${league.season}:${league.teamIds.join(",")}:${await sources.snapshotVersion()}`;
    const cached = cache.get(sport);
    if (cached?.key === key) return cached.result;

    const { fit, daysPerSeason } = settings[sport];
    const { table, points, ages } = fitLeagueReference(fit, await sources.readSnapshots(), league, daysPerSeason);
    const result: LeagueReferenceResult = table
      ? { table, status: { kind: "fitted" } }
      : {
          table: null,
          status: { kind: "sparse", points, pointsNeeded: MIN_LEAGUE_POINTS, ages, agesNeeded: MIN_LEAGUE_AGES },
        };
    cache.set(sport, { key, result });
    return result;
  };
}
