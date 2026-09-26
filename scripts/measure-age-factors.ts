/**
 * Re-measures AGE_PACE_FACTORS (src/sports/hockey/growthPace.ts) from a backup
 * file. Run it when more history has accumulated, or after the team's training
 * facilities change, and copy the factors it prints into AGE_PACE_FACTORS.
 *
 * It compares different players over the same months - never one player
 * across their own history, which mixes facility levels when facilities
 * changed or the player transferred. So pick ERA_START after the last
 * facility or coach change.
 *
 * Uses the real measureGrowthPace() and position formula, so the numbers
 * match what the Player Report shows. Build and run it like the checks in
 * test/README.md (an SSR bundle via a throwaway vite config, input this file):
 *
 *   BACKUP=path/to/ppm-assistant-backup.json ERA_START=2025-12-01 node check.mjs
 *
 * Optional: TEAM=<team id> picks the cache (default: the one with the most
 * history); WINDOW_DAYS overrides the window (default PACE_WINDOW_DAYS).
 */

import fs from "fs";
import {
  AGE_PACE_FACTORS,
  PACE_MIN_SPAN_DAYS,
  PACE_WINDOW_DAYS,
  bestPositionRating,
  measureGrowthPace,
} from "@/sports/hockey/growthPace";
import { hockeyPlayerProfile } from "@/sports/hockey/playerProfile";
import { BackupFile } from "@/types/Backup";
import { SkillHistoryEntry } from "@/types/SkillHistory";

const backup = JSON.parse(fs.readFileSync(process.env.BACKUP!, "utf8")) as BackupFile;
const eraStart = process.env.ERA_START ?? "2025-12-01";
const windowDays = Number(process.env.WINDOW_DAYS ?? PACE_WINDOW_DAYS);

// Ages come from the cache as of the export, and historyEntryAge() measures
// back from "now" - so "now" has to be the moment the backup was taken.
const exportedAt = Date.parse(backup.exportedAt);
Date.now = () => exportedAt;

const byPlayer = new Map<string, SkillHistoryEntry[]>();
for (const entry of backup.skillHistory) {
  if (!entry.skills || entry.date < eraStart) continue;
  const list = byPlayer.get(entry.playerId);
  if (list) list.push(entry);
  else byPlayer.set(entry.playerId, [entry]);
}

const caches = Object.values(backup.playerCaches);
const cache =
  caches.find((c) => c.teamId === process.env.TEAM) ??
  caches
    .map((c) => ({
      c,
      history: Object.keys(c.players).reduce((n, id) => n + (byPlayer.get(id)?.length ?? 0), 0),
    }))
    .sort((a, b) => b.history - a.history)[0].c;

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

const bandOf = (age: number) =>
  [...AGE_PACE_FACTORS].reverse().find((band) => age >= band.fromAge)!;

const paces = new Map<number, { values: number[]; players: Set<string> }>();

for (const [id, stored] of Object.entries(cache.players)) {
  // Only our own squad: other teams' players train under other facilities.
  if (stored.baseInfo.teamId !== cache.teamId) continue;
  const history = (byPlayer.get(id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
  const exactAgeNow =
    stored.baseInfo.age + (cache.currentSeasonDay || 1) / hockeyPlayerProfile.daysPerSeason;

  // Back-to-back windows, so no day counts twice.
  let start = 0;
  while (start < history.length) {
    let end = start;
    while (
      end + 1 < history.length &&
      daysBetween(history[start].date, history[end + 1].date) <= windowDays
    ) {
      end++;
    }

    const window = history.slice(start, end + 1);
    const last = window[window.length - 1];
    if (last.skills && daysBetween(window[0].date, last.date) >= PACE_MIN_SPAN_DAYS) {
      const pace = measureGrowthPace(window, exactAgeNow, bestPositionRating(last.skills).name);
      if (pace?.pace != null) {
        const band = bandOf(pace.midAge).fromAge;
        const bucket = paces.get(band) ?? { values: [], players: new Set<string>() };
        bucket.values.push(pace.pace);
        bucket.players.add(id);
        paces.set(band, bucket);
      }
    }
    start = end === start ? start + 1 : end;
  }
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const reference = paces.get(AGE_PACE_FACTORS[0].fromAge);
if (!reference) throw new Error("No windows in the reference band - try an earlier ERA_START.");
const referencePace = median(reference.values);

console.log(
  `Team ${cache.teamId}, since ${eraStart}, ${windowDays}-day windows. ` +
    `Reference pace ${Math.round(referencePace * 100)}%.\n`
);
console.log("from age  players  windows  median   factor  (current)");
AGE_PACE_FACTORS.forEach((band) => {
  const bucket = paces.get(band.fromAge);
  if (!bucket) {
    console.log(`${String(band.fromAge).padEnd(8)}  no data`);
    return;
  }
  const pace = median(bucket.values);
  console.log(
    `${String(band.fromAge).padEnd(8)}  ${String(bucket.players.size).padStart(7)}  ` +
      `${String(bucket.values.length).padStart(7)}  ${`${Math.round(pace * 100)}%`.padStart(6)}  ` +
      `${(pace / referencePace).toFixed(2).padStart(7)}  (${band.factor.toFixed(2)})`
  );
});
