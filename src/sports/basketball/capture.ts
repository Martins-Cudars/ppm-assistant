/**
 * Basketball capture: the player cache and the daily skill history.
 *
 * Basketball has no training-progress page, so unlike hockey there is no past
 * to back-fill - history exists only from the day capture starts, one entry
 * per player per day, from the squad overview (the whole team at once) and
 * from profile visits (any player, other teams' included). Every day not
 * captured is gone for good.
 *
 * Entries go to basketball's own history store and cache key, so the same
 * player id in hockey and basketball can never collide.
 */

import {
  BasketballPlayer,
  BasketballPlayerInfo,
  BasketballSkills,
} from "@/sports/basketball/classes/BasketballPlayer";
import { SkillHistoryEntry, SkillHistorySource } from "@/types/SkillHistory";
import { StoredPlayerData } from "@/types/StoredPlayer";
import { upsertSkillHistoryEntries } from "@/storage/skillHistoryDb";
import { saveSquadRoster, saveStoredPlayers } from "@/storage/playerCache";
import { getCurrentSeasonDay, getUserTeamId } from "@/utils/dom";
import { isUsableNumber, normalizePlayerId, todayIsoDate } from "@/base/captureUtils";

export type StoredBasketballPlayer = StoredPlayerData<BasketballPlayerInfo, BasketballSkills>;

type CaptureSource = Extract<SkillHistorySource, "PlayersList" | "PlayerProfile">;

// Shared with every sport's capture; normalizePlayerId is re-exported so
// basketball's existing imports keep working.
export { normalizePlayerId } from "@/base/captureUtils";

/**
 * Today's history entry for one player, or null when there's nothing worth a
 * dated row. Unlike hockey's, it also records height and XP: the basketball
 * rating depends on height, and XP can't be recovered later.
 */
export function buildBasketballEntry(
  player: BasketballPlayer,
  source: CaptureSource,
  date = todayIsoDate()
): SkillHistoryEntry<BasketballSkills> | null {
  const id = normalizePlayerId(player.id);
  if (!id) return null;

  const overallRating =
    isUsableNumber(player.overallRating) && player.overallRating > 0
      ? player.overallRating
      : undefined;
  const skills = player.skills;
  if (overallRating === undefined && !skills) return null;

  // Only set what was read, so the worker's per-field merge keeps any value
  // another capture stored for the same day.
  const entry: SkillHistoryEntry<BasketballSkills> = {
    id: `${id}:${date}`,
    playerId: id,
    date,
    capturedAt: new Date().toISOString(),
    source,
  };
  if (overallRating !== undefined) entry.overallRating = overallRating;
  if (skills) entry.skills = skills;
  if (isUsableNumber(player.height) && player.height > 0) entry.height = player.height;
  if (isUsableNumber(player.experience)) entry.experience = player.experience;
  return entry;
}

/** One player as stored in the basketball team cache. */
export function serializeBasketballPlayer(
  player: BasketballPlayer,
  source: CaptureSource,
  teamId: string | undefined
): StoredBasketballPlayer | null {
  const id = normalizePlayerId(player.id);
  if (!id) return null;

  return {
    sport: "basketball",
    baseInfo: {
      id,
      name: player.name,
      age: player.age,
      careerLongitivity: player.careerLongitivity,
      overallRating: player.overallRating,
      averageTrainingRatio: player.averageTrainingRatio,
      height: player.height,
      teamId: teamId ?? player.teamId,
      teamName: player.teamName,
    },
    skills: player.skills ?? null,
    trainingQualities: (player.trainingQualities as Record<string, number> | undefined) ?? null,
    experience: player.experience ?? null,
    injuryDays: player.injuryDays ?? 0,
    scoutingStatus: "SCOUTED",
    metadata: {
      updatedAt: new Date().toISOString(),
      seasonDay: getCurrentSeasonDay(),
      dataCompleteness: player.trainingQualities ? "full" : player.skills ? "partial" : "minimal",
      lastViewSource: source,
    },
  };
}

/**
 * A cached basketball player back as a BasketballPlayer, with positions and
 * training qualities recalculated - so ratings always follow the current
 * position model (height included) rather than whatever was stored.
 */
export function deserializeBasketballPlayer(stored: StoredBasketballPlayer): BasketballPlayer {
  const player = new BasketballPlayer(
    stored.baseInfo,
    new Date(stored.metadata.updatedAt),
    true,
    stored.metadata.seasonDay,
    stored.skills ?? undefined,
    stored.experience ?? undefined,
    (stored.trainingQualities as BasketballSkills | null) ?? undefined
  );
  player.teamId = stored.baseInfo.teamId;
  player.teamName = stored.baseInfo.teamName;
  player.injuryDays = stored.injuryDays;
  player.calculatePositions();
  player.calculatePositionTrainingQualities();
  return player;
}

/**
 * Stores what a page shows: the players in the cache and today's history, in
 * one write each. `ownSquad` marks the squad overview - its players are the
 * roster, saved after the cache write rather than alongside it, since both
 * rewrite the same key.
 *
 * Skipped without a team id: the cache would land under team-unknown, which
 * clearInvalidCaches() deletes on the next page load.
 */
export async function captureBasketballPlayers(
  players: BasketballPlayer[],
  source: CaptureSource,
  options: { ownSquad: boolean; teamId?: string }
): Promise<void> {
  const userTeamId = getUserTeamId();
  if (userTeamId === "unknown") {
    console.warn("[BasketballCapture] Skipped - cannot determine the team id");
    return;
  }

  const teamId = options.ownSquad ? userTeamId : options.teamId;
  const stored = players
    .map((player) => serializeBasketballPlayer(player, source, teamId))
    .filter((player): player is StoredBasketballPlayer => player !== null);
  const entries = players
    .map((player) => buildBasketballEntry(player, source))
    .filter((entry): entry is SkillHistoryEntry<BasketballSkills> => entry !== null);

  await Promise.all([
    saveStoredPlayers(stored, "basketball").then(() =>
      options.ownSquad && stored.length > 0
        ? saveSquadRoster(
            stored.map((player) => player.baseInfo.id),
            "basketball"
          )
        : undefined
    ),
    upsertSkillHistoryEntries(entries, "basketball"),
  ]);

  console.log(
    `[BasketballCapture] ${source}: cached ${stored.length} player(s), ${entries.length} history entr${
      entries.length === 1 ? "y" : "ies"
    }`
  );
}
