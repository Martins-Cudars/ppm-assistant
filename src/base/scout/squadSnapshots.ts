/**
 * The user's own squad as scout snapshots, from the squad overview - so the
 * report's League and Elite lines include the user's players, as any other
 * team's would be. Called by each sport's squad-overview view.
 */

import { isUsableNumber, normalizePlayerId } from "@/base/captureUtils";
import { RosterRow } from "@/base/scout/rosterParser";
import { captureScoutSnapshots } from "@/base/scout/scoutCapture";
import { Sport } from "@/types/Sport";
import { getCurrentSeason, getTeamNameFromUserPlayerList, getUserTeamId } from "@/utils/dom";

/** What the overview parsers give for a player, whichever sport. */
export interface SquadPlayerLike {
  id: string;
  name: string;
  age: number;
  overallRating: number;
  height?: number;
  averageTrainingRatio?: number;
  careerLongitivity?: number;
}

export function captureSquadSnapshots(players: SquadPlayerLike[], sport: Sport): void {
  const userTeamId = getUserTeamId();
  if (userTeamId === "unknown") return;

  // Only what the overview parser actually read - a NaN must not be stored.
  const read = (value: unknown) => (isUsableNumber(value) ? value : undefined);
  const rows = players.flatMap((player): RosterRow[] => {
    const playerId = normalizePlayerId(player.id);
    if (!playerId || !isUsableNumber(player.age) || !(player.overallRating > 0)) return [];
    return [
      {
        playerId,
        name: player.name,
        age: player.age,
        height: read(player.height),
        averageQuality: read(player.averageTrainingRatio),
        careerLongevity: read(player.careerLongitivity),
        overallRating: player.overallRating,
      },
    ];
  });
  if (rows.length === 0) return;

  const season = getCurrentSeason();
  captureScoutSnapshots(
    rows,
    {
      teamId: userTeamId,
      teamName: getTeamNameFromUserPlayerList().replace(/^unknown$/, "") || undefined,
      season: season?.season,
      seasonDay: season?.seasonDay,
      source: "PlayersList",
    },
    sport
  ).catch((error) => console.error(`[SquadSnapshots] ${sport} capture failed:`, error));
}
