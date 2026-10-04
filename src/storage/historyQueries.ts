/**
 * What the Player Reports used to ask the background worker for in separate
 * messages - coverage summaries, storage stats, each player's recent window,
 * the days around a birthday - worked out from the one full export the report
 * already reads. Each mirrors its worker counterpart in src/background.ts, so
 * the numbers are the same; the worker keeps its versions for the pages that
 * don't hold the whole store (the squad overview, the profile charts).
 *
 * Pure, so the checks can run them.
 */

import { SkillHistoryStats, SkillHistorySummary } from "@/types/SkillHistory";

type Dated = { playerId: string; date: string };

/** Whole days between two ISO dates. UTC arithmetic, so DST can't skew it. */
export function daysBetween(fromIso: string, toIso: string): number {
  const [fromYear, fromMonth, fromDay] = fromIso.split("-").map(Number);
  const [toYear, toMonth, toDay] = toIso.split("-").map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((to - from) / 86400000);
}

/** Entries by player, each player's days in date order (the store's key order). */
export function groupByPlayer<E extends Dated>(entries: E[]): Map<string, E[]> {
  const byPlayer = new Map<string, E[]>();
  entries.forEach((entry) => {
    const list = byPlayer.get(entry.playerId);
    if (list) list.push(entry);
    else byPlayer.set(entry.playerId, [entry]);
  });
  byPlayer.forEach((list) => list.sort((a, b) => a.date.localeCompare(b.date)));
  return byPlayer;
}

/** Coverage per player, keyed by player id - as the worker's getSummaries(). */
export function summariesFrom<E extends Dated>(byPlayer: Map<string, E[]>): Map<string, SkillHistorySummary> {
  const summaries = new Map<string, SkillHistorySummary>();
  byPlayer.forEach((entries, playerId) => {
    if (entries.length === 0) return;
    const dates = new Set(entries.map((entry) => entry.date));
    const sorted = [...dates].sort();
    const firstDate = sorted[0];
    const lastDate = sorted[sorted.length - 1];
    summaries.set(playerId, {
      playerId,
      days: dates.size,
      firstDate,
      lastDate,
      missingDays: daysBetween(firstDate, lastDate) + 1 - dates.size,
    });
  });
  return summaries;
}

/**
 * Records, players and JSON bytes - as the worker's getStats(). `originBytes`
 * is the browser's own figure for the extension origin, which an extension
 * page shares with the worker, so the page can ask for it directly.
 */
export async function statsFrom<E extends Dated>(entries: E[]): Promise<SkillHistoryStats> {
  const players = new Set<string>();
  let jsonBytes = 0;
  entries.forEach((entry) => {
    players.add(entry.playerId);
    jsonBytes += JSON.stringify(entry).length;
  });

  let originBytes: number | undefined;
  try {
    originBytes = (await navigator.storage?.estimate())?.usage;
  } catch {
    // Quota reporting is best-effort; the measured size stands without it.
  }
  return { records: entries.length, players: players.size, jsonBytes, originBytes };
}

/**
 * Each player's days within `days` of their own latest stored day - as the
 * worker's getLatestWindowEntries(). Anchored on each player's latest day, so
 * a player last seen weeks ago still gets the weeks before that.
 */
export function latestWindow<E extends Dated>(byPlayer: Map<string, E[]>, days: number): Map<string, E[]> {
  const windows = new Map<string, E[]>();
  byPlayer.forEach((entries, playerId) => {
    if (entries.length === 0) return;
    const latest = entries.reduce((max, entry) => (entry.date > max ? entry.date : max), entries[0].date);
    windows.set(
      playerId,
      entries.filter((entry) => daysBetween(entry.date, latest) <= days)
    );
  });
  return windows;
}

/**
 * The target players' days within `days` either side of each one's target
 * date - as the worker's getEntriesNearDates(). Players with nothing in range
 * are left out, as there.
 */
export function nearDates<E extends Dated>(
  byPlayer: Map<string, E[]>,
  targets: { playerId: string; date: string }[],
  days: number
): Map<string, E[]> {
  const near = new Map<string, E[]>();
  targets.forEach(({ playerId, date }) => {
    const entries = (byPlayer.get(playerId) ?? []).filter(
      (entry) => Math.abs(daysBetween(date, entry.date)) <= days
    );
    if (entries.length > 0) near.set(playerId, entries);
  });
  return near;
}
