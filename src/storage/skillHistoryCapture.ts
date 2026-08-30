/**
 * Captures "today" history entries from players we're currently looking at, as
 * opposed to the bulk month-at-a-time capture that viewTrainingProgress.ts does
 * from the training progress page.
 *
 * The training progress page only exists for players on our own team, so this
 * is the only way to build history for other teams' players. It records one
 * point per day per player - re-visiting a page the same day just refreshes
 * that day's entry rather than adding a duplicate, since the entry id is
 * `${playerId}:${date}`.
 */

import { HockeyPlayer, HockeySkills } from "@/sports/hockey/classes/HockeyPlayer";
import { SkillHistoryEntry, SkillHistorySource } from "@/types/SkillHistory";
import { upsertSkillHistoryEntries } from "@/storage/skillHistoryDb";

/**
 * Today's date as "YYYY-MM-DD" in local time.
 *
 * Deliberately not toISOString().slice(0, 10), which would report the UTC day
 * and so straddle the wrong date for anyone playing in the evening west of
 * UTC or the early morning east of it. The training progress page's dates are
 * likewise local, so the two capture paths must agree or they'd write two
 * entries for one day.
 */
function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}

function isUsableNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Builds today's entry for one player, or null when there's nothing worth
 * storing - an entry with neither an overall rating nor skills would just be a
 * dated placeholder.
 */
function buildTodaysEntry(
  player: HockeyPlayer,
  source: SkillHistorySource
): SkillHistoryEntry | null {
  // The list parsers fall back to the literal "unknown" when a row's name link
  // won't parse, so an empty check alone isn't enough - that id would be stored
  // and then surface as a phantom player in the Player Report.
  if (!player.id || player.id === "unknown") return null;

  const overallRating =
    isUsableNumber(player.overallRating) && player.overallRating > 0
      ? player.overallRating
      : undefined;

  // player.skills is only populated when the attributes are visible to us;
  // unscouted opponents give us an overall rating and nothing else.
  const skills = player.skills as HockeySkills | undefined;

  if (overallRating === undefined && !skills) return null;

  const date = todayIsoDate();

  return {
    id: `${player.id}:${date}`,
    playerId: player.id,
    date,
    overallRating,
    skills,
    capturedAt: new Date().toISOString(),
    source,
  };
}

/**
 * Records today's snapshot for a whole page's worth of players in a single
 * round-trip, so a squad-overview visit costs one message and one IndexedDB
 * transaction rather than one per row.
 *
 * Fire-and-forget: history capture is a background nicety and must never break
 * the page it's called from.
 */
export function captureTodaysHistoryEntries(
  players: HockeyPlayer[],
  source: SkillHistorySource
): void {
  const entries = players
    .map((player) => buildTodaysEntry(player, source))
    .filter((entry): entry is SkillHistoryEntry => entry !== null);

  if (entries.length === 0) return;

  upsertSkillHistoryEntries(entries)
    .then(() => {
      console.log(
        `[SkillHistoryCapture] Stored ${entries[0].date} snapshot for ${entries.length} player(s) from ${source}`
      );
    })
    .catch((error) => {
      console.error("[SkillHistoryCapture] Failed to store snapshots:", error);
    });
}

/**
 * Records today's snapshot for a single player. Silently does nothing when
 * there's nothing worth storing.
 */
export function captureTodaysHistoryEntry(
  player: HockeyPlayer,
  source: SkillHistorySource
): void {
  captureTodaysHistoryEntries([player], source);
}
