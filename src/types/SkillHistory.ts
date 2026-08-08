import { HockeySkills } from "@/sports/hockey/classes/HockeyPlayer";

/**
 * One day's worth of skill data for a player, parsed from the
 * treninu-progress.html ("training progress") page.
 *
 * Deliberately excludes per-day training deltas/multipliers (e.g. "(T:1.26)")
 * shown on the page - only cumulative values are stored. Deltas can be
 * derived later by diffing consecutive entries if ever needed.
 */
export interface SkillHistoryEntry {
  id: string; // `${playerId}:${date}` composite key, e.g. "23869664:2026-07-14"
  playerId: string;
  date: string; // ISO "YYYY-MM-DD"
  kr: number;
  skills: HockeySkills;
  capturedAt: string; // ISO timestamp of when this row was parsed
}
