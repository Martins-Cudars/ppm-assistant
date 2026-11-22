/**
 * Re-measures AGE_PACE_FACTORS (src/sports/<sport>/growthPace.ts, hockey or
 * soccer) from a backup file. Run it when more history has accumulated, after
 * the team's training facilities change, or after the reference table
 * changes, and copy the factors it prints into AGE_PACE_FACTORS.
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
 * Optional: SPORT=hockey|soccer (default hockey); TEAM=<team id> picks the
 * cache (default: the sport's one with the most history); WINDOW_DAYS
 * overrides the window (default PACE_WINDOW_DAYS). Factors are relative to the
 * first band whose current factor is 1.0 (hockey <=21, soccer 17+).
 */

import fs from "fs";
import * as hockey from "@/sports/hockey/growthPace";
import * as soccer from "@/sports/soccer/growthPace";
import { BackupFile } from "@/types/Backup";
import { SkillHistoryEntry } from "@/types/SkillHistory";

const sport = process.env.SPORT === "soccer" ? "soccer" : "hockey";
const {
  AGE_PACE_FACTORS,
  PACE_MIN_SPAN_DAYS,
  PACE_WINDOW_DAYS,
  bestPositionRating,
  measureGrowthPace,
} = sport === "soccer" ? soccer : hockey;
const daysPerSeason = (sport === "soccer" ? soccer.soccerGrowthConfig : hockey.hockeyGrowthConfig).daysPerSeason;

const backup = JSON.parse(fs.readFileSync(process.env.BACKUP!, "utf8")) as BackupFile;
const eraStart = process.env.ERA_START ?? "2025-12-01";
const windowDays = Number(process.env.WINDOW_DAYS ?? PACE_WINDOW_DAYS);

// Ages come from the cache as of the export, and historyEntryAge() measures
// back from "now" - so "now" has to be the moment the backup was taken.
const exportedAt = Date.parse(backup.exportedAt);
Date.now = () => exportedAt;

const byPlayer = new Map<string, SkillHistoryEntry[]>();
const history = (
  sport === "hockey" ? backup.skillHistory : (backup.sportSkillHistory?.[sport] ?? [])
) as SkillHistoryEntry[];
for (const entry of history) {
  if (!entry.skills || entry.date < eraStart) continue;
  const list = byPlayer.get(entry.playerId);
  if (list) list.push(entry);
  else byPlayer.set(entry.playerId, [entry]);
}

const caches = Object.entries(backup.playerCaches)
  .filter(([key]) => key.startsWith(`ppm-assistant:${sport}:`))
  .map(([, c]) => c);
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
    stored.baseInfo.age + (cache.currentSeasonDay || 1) / daysPerSeason;

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pace = measureGrowthPace(window as any, exactAgeNow, bestPositionRating(last.skills as any).name);
      // basePace, not pace: the projection applies these factors to the base
      // (main-skill) part only, so they have to be measured on it.
      if (pace?.basePace != null) {
        const band = bandOf(pace.midAge).fromAge;
        const bucket = paces.get(band) ?? { values: [], players: new Set<string>() };
        bucket.values.push(pace.basePace);
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

const referenceBand = AGE_PACE_FACTORS.find((band) => band.factor === 1) ?? AGE_PACE_FACTORS[0];
const reference = paces.get(referenceBand.fromAge);
if (!reference) throw new Error("No windows in the reference band - try an earlier ERA_START.");
const referencePace = median(reference.values);

console.log(
  `${sport}: team ${cache.teamId}, since ${eraStart}, ${windowDays}-day windows. ` +
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
