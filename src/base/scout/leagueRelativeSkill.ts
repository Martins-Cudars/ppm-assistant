/**
 * The league half of relative skill ("87% / 95%") on a page: the 100% line of
 * the viewer's own league. The background worker fits it from the stored
 * league list and scout snapshots (src/storage/leagueReferenceFit.ts) and
 * sends back only the table.
 *
 * - A view's entry point calls `loadLeagueReference` once; nothing else starts
 *   I/O. The player model stays pure: callers pass the table to
 *   `player.getRelativeSkillMaxima(table)`.
 * - `leagueLine` reads the loaded table and status, reactively: a component
 *   that read "loading" re-renders once it arrives. DOM renderers wait on the
 *   promise `loadLeagueReference` returns.
 * - No league list, a list from an earlier season, or too few league
 *   player-seasons or measured ages: no table, and the league value shows
 *   "???" with the status's reason in the tooltip.
 */

import { shallowReactive } from "vue";
import type { LeagueLineStatus } from "@/base/relativeSkill";
import { GrowthPrediction } from "@/types/GrowthData";
import { SkillHistoryMessage, SkillHistoryResponse } from "@/types/SkillHistoryMessages";
import { Sport } from "@/types/Sport";
import { getCurrentSeason } from "@/utils/dom";

/** A sport's league table, or null with the reason (src/base/relativeSkill.ts). */
export type LeagueLine = { table: GrowthPrediction | null; status: LeagueLineStatus };

const LOADING: LeagueLine = { table: null, status: { kind: "loading" } };

const lines = shallowReactive(new Map<Sport, LeagueLine>());
const pending = new Map<Sport, Promise<LeagueLine>>();

async function request(sport: Sport, currentSeason: number | null): Promise<LeagueLine> {
  let line: LeagueLine = { table: null, status: { kind: "error" } };
  try {
    const message: SkillHistoryMessage = { type: "RELATIVE_SKILL_LEAGUE", sport, currentSeason };
    const response: SkillHistoryResponse = await chrome.runtime.sendMessage(message);
    if (response?.type === "RELATIVE_SKILL_LEAGUE") line = { table: response.table, status: response.status };
  } catch (error) {
    console.error("[LeagueRelativeSkill] Failed to load the league line:", error);
  }
  lines.set(sport, line);
  return line;
}

/**
 * Asks the worker for the sport's league table, once per page; later calls
 * return the same promise. The current season comes from the game's top bar.
 */
export function loadLeagueReference(
  sport: Sport,
  currentSeason: number | null = getCurrentSeason()?.season ?? null
): Promise<LeagueLine> {
  let promise = pending.get(sport);
  if (!promise) {
    promise = request(sport, currentSeason);
    pending.set(sport, promise);
  }
  return promise;
}

/** The loaded league line; "loading" until it arrives (or when never loaded). Reactive. */
export function leagueLine(sport: Sport): LeagueLine {
  return lines.get(sport) ?? LOADING;
}
