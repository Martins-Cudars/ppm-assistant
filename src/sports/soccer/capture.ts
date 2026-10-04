/**
 * Soccer capture: the player cache and the daily skill history, like
 * basketball's (src/sports/basketball/capture.ts).
 *
 * - The squad overview stores the whole team at once, plus the roster.
 * - A profile visit stores that player, other teams' included; an unscouted
 *   player gives an OR-only day.
 * - The training-progress page back-fills the past (src/base/trainingProgress.ts).
 *
 * Entries go to soccer's own history store and cache key, so the same player
 * id in two games can never collide.
 */

import { SoccerPlayer, SoccerPlayerInfo, SoccerSkills } from "@/sports/soccer/classes/SoccerPlayer";
import { SkillHistoryEntry, SkillHistorySource } from "@/types/SkillHistory";
import { StoredPlayerData } from "@/types/StoredPlayer";
import { upsertSkillHistoryEntries } from "@/storage/skillHistoryDb";
import { saveSquadRoster, saveStoredPlayers } from "@/storage/playerCache";
import { getCurrentSeasonDay, getUserTeamId } from "@/utils/dom";
import { isUsableNumber, normalizePlayerId, todayIsoDate } from "@/base/captureUtils";

export type StoredSoccerPlayer = StoredPlayerData<SoccerPlayerInfo, SoccerSkills>;

type CaptureSource = Extract<SkillHistorySource, "PlayersList" | "PlayerProfile">;

/**
 * Today's history entry for one player, or null when there's nothing worth a
 * dated row. Skills and XP only when the page showed them (`isVisible`):
 * BasePlayer fills a missing XP with an estimate, which must never be stored
 * as if it were read.
 */
export function buildSoccerEntry(
  player: SoccerPlayer,
  source: CaptureSource,
  date = todayIsoDate()
): SkillHistoryEntry<SoccerSkills> | null {
  const id = normalizePlayerId(player.id);
  if (!id) return null;

  const overallRating =
    isUsableNumber(player.overallRating) && player.overallRating > 0
      ? player.overallRating
      : undefined;
  const skills = player.isVisible ? player.skills : undefined;
  if (overallRating === undefined && !skills) return null;

  // Only set what was read, so the worker's per-field merge keeps any value
  // another capture stored for the same day.
  const entry: SkillHistoryEntry<SoccerSkills> = {
    id: `${id}:${date}`,
    playerId: id,
    date,
    capturedAt: new Date().toISOString(),
    source,
  };
  if (overallRating !== undefined) entry.overallRating = overallRating;
  if (skills) entry.skills = skills;
  if (player.isVisible && isUsableNumber(player.experience)) entry.experience = player.experience;
  return entry;
}

/** One player as stored in the soccer team cache; null without a usable id or skills. */
export function serializeSoccerPlayer(
  player: SoccerPlayer,
  source: CaptureSource,
  teamId: string | undefined
): StoredSoccerPlayer | null {
  const id = normalizePlayerId(player.id);
  if (!id || !player.isVisible || !player.skills) return null;

  return {
    sport: "soccer",
    baseInfo: {
      id,
      name: player.name,
      age: player.age,
      careerLongitivity: player.careerLongitivity,
      overallRating: player.overallRating,
      averageTrainingRatio: player.averageTrainingRatio,
      teamId: teamId ?? player.teamId,
      teamName: player.teamName,
    },
    skills: player.skills,
    trainingQualities: player.trainingQualities ?? null,
    experience: player.experience ?? null,
    injuryDays: player.injuryDays ?? 0,
    scoutingStatus: "SCOUTED",
    metadata: {
      updatedAt: new Date().toISOString(),
      seasonDay: getCurrentSeasonDay(),
      dataCompleteness: player.trainingQualities ? "full" : "partial",
      lastViewSource: source,
    },
  };
}

/** A cached soccer player back as a SoccerPlayer, positions recalculated. */
export function deserializeSoccerPlayer(stored: StoredSoccerPlayer): SoccerPlayer {
  const player = new SoccerPlayer(
    stored.baseInfo,
    new Date(stored.metadata.updatedAt),
    true,
    true,
    stored.metadata.seasonDay,
    stored.skills ?? undefined,
    stored.experience ?? undefined,
    stored.trainingQualities ?? undefined,
    stored.injuryDays
  );
  player.teamId = stored.baseInfo.teamId;
  player.teamName = stored.baseInfo.teamName;
  player.calculatePositions();
  if (stored.trainingQualities) player.calculatePositionTrainingQualities();
  return player;
}

/**
 * Stores what a page shows: the players in the cache and today's history, in
 * one write each. `ownSquad` marks the squad overview - its players are the
 * roster, saved after the cache write since both rewrite the same key.
 *
 * Skipped without a team id: the cache would land under team-unknown.
 */
export async function captureSoccerPlayers(
  players: SoccerPlayer[],
  source: CaptureSource,
  options: { ownSquad: boolean; teamId?: string }
): Promise<void> {
  const userTeamId = getUserTeamId();
  if (userTeamId === "unknown") {
    console.warn("[SoccerCapture] Skipped - cannot determine the team id");
    return;
  }

  const teamId = options.ownSquad ? userTeamId : options.teamId;
  const stored = players
    .map((player) => serializeSoccerPlayer(player, source, teamId))
    .filter((player): player is StoredSoccerPlayer => player !== null);
  const entries = players
    .map((player) => buildSoccerEntry(player, source))
    .filter((entry): entry is SkillHistoryEntry<SoccerSkills> => entry !== null);

  await Promise.all([
    saveStoredPlayers(stored, "soccer").then(() =>
      options.ownSquad && stored.length > 0
        ? saveSquadRoster(
            stored.map((player) => player.baseInfo.id),
            "soccer"
          )
        : undefined
    ),
    upsertSkillHistoryEntries(entries, "soccer"),
  ]);

  console.log(
    `[SoccerCapture] ${source}: cached ${stored.length} player(s), ${entries.length} history entr${
      entries.length === 1 ? "y" : "ies"
    }`
  );
}
