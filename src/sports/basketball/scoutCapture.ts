/**
 * Turning what a page shows into scout snapshots (src/types/ScoutSnapshot.ts)
 * and storing them. Two pages feed it: any team's "Players" page, and the
 * user's own squad overview - so the user's players are in the reference too.
 */

import { todayIsoDate } from "@/base/captureUtils";
import { RosterRow } from "@/sports/basketball/parsers/teamRoster";
import { upsertScoutSnapshots } from "@/storage/scoutSnapshotDb";
import { ScoutSnapshot, ScoutSnapshotSource } from "@/types/ScoutSnapshot";

export interface SnapshotContext {
  teamId: string;
  teamName?: string;
  season?: number;
  seasonDay?: number;
  source: ScoutSnapshotSource;
}

/** Today's snapshot of one roster row. Only what was read is set, so merges keep the rest. */
export function buildScoutSnapshot(
  row: RosterRow,
  context: SnapshotContext,
  date = todayIsoDate()
): ScoutSnapshot {
  const snapshot: ScoutSnapshot = {
    id: `${row.playerId}:${date}`,
    playerId: row.playerId,
    date,
    name: row.name,
    teamId: context.teamId,
    age: row.age,
    overallRating: row.overallRating,
    capturedAt: new Date().toISOString(),
    source: context.source,
  };
  if (context.teamName) snapshot.teamName = context.teamName;
  if (context.season !== undefined) snapshot.season = context.season;
  if (context.seasonDay !== undefined) snapshot.seasonDay = context.seasonDay;
  if (row.height !== undefined) snapshot.height = row.height;
  if (row.averageQuality !== undefined) snapshot.averageQuality = row.averageQuality;
  if (row.careerLongevity !== undefined) snapshot.careerLongevity = row.careerLongevity;
  return snapshot;
}

/** Stores a page's rows as today's snapshots; resolves how many were written. */
export async function captureScoutSnapshots(rows: RosterRow[], context: SnapshotContext): Promise<number> {
  const snapshots = rows.map((row) => buildScoutSnapshot(row, context));
  const { written } = await upsertScoutSnapshots(snapshots, "basketball");
  console.log(
    `[ScoutCapture] ${context.source}: ${written} snapshot(s) for team ${context.teamId}` +
      (context.teamName ? ` (${context.teamName})` : "")
  );
  return written;
}
