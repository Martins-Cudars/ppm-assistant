/**
 * Shared helpers for converting captured skill-history entries into
 * age/value chart points. Used by both the single-player growth chart
 * (PlayerGrowthChart.vue) and the multi-player comparison chart
 * (PlayerGrowthComparisonChart.vue).
 */

import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { hockeyPlayerProfile } from "@/sports/hockey/playerProfile";
import { calculatePositions } from "@/classes/playerCalculations";
import { SkillHistoryEntry } from "@/types/SkillHistory";

/**
 * The player's current age expressed as a fraction, e.g. 18.25 for a
 * player a quarter of the way through their age-18 season.
 *
 * `seasonDay` must come from the game page (getCurrentSeasonDay()) or, on
 * extension pages that have no game DOM, from playerStore.currentSeasonDay.
 */
export function getExactAge(player: HockeyPlayer, seasonDay: number): number {
  return player.age + seasonDay / hockeyPlayerProfile.daysPerSeason;
}

/**
 * Converts an entry's calendar date into an approximate age at that date by
 * assuming real calendar days and in-game season days advance 1:1, since
 * there's no per-historical-day season day value available to compute this
 * exactly.
 */
export function historyEntryAge(
  entry: SkillHistoryEntry,
  currentExactAge: number
): number {
  const daysAgo =
    (Date.now() - Date.parse(`${entry.date}T00:00:00`)) / 86_400_000;

  return currentExactAge - daysAgo / hockeyPlayerProfile.daysPerSeason;
}

/**
 * The entry's overall rating, tolerating entries written before `kr` was
 * renamed to `overallRating`. Returns null when the entry carries neither -
 * e.g. a training-progress row captured before profiles were tracked.
 */
export function readEntryOverallRating(entry: SkillHistoryEntry): number | null {
  const value = entry.overallRating ?? entry.kr;

  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

/**
 * The entry's best positional "Base" (no-XP) rating. Only the Base rating can
 * be reconstructed for historical days, since neither capture path records a
 * per-day experience value.
 *
 * Returns null for entries with no skills attached - an unscouted player's
 * profile yields an overall rating but no attributes.
 */
export function readEntryBaseRating(entry: SkillHistoryEntry): number | null {
  if (!entry.skills) return null;

  const positions = calculatePositions(
    entry.skills,
    hockeyPlayerProfile.positionSettings,
    0,
    hockeyPlayerProfile.bonusCapRatio ?? 1
  );

  return Math.max(...positions.map((p) => p.ratingWithBonus));
}

/**
 * Converts a single history entry into a {x: age, y: base rating} chart point,
 * or null when the entry has no skills to derive a rating from.
 */
export function historyEntryToAgePoint(
  entry: SkillHistoryEntry,
  currentExactAge: number
): { x: number; y: number } | null {
  const bestRating = readEntryBaseRating(entry);
  if (bestRating === null) return null;

  return { x: historyEntryAge(entry, currentExactAge), y: bestRating };
}

/**
 * Default charting window. 14 days gives 8 points per 112-day season, which is
 * enough to see the shape of a growth curve without drawing a point per pixel.
 * Change this one constant to re-tune every chart.
 */
export const CHART_BUCKET_DAYS = 14;

/**
 * Which fixed window a date falls in, anchored to the UTC epoch rather than to
 * the player's own first entry. The shared origin is the point: every player's
 * sampled points then land on the same window boundaries, so the comparison
 * chart's lines stay directly comparable instead of each being offset by
 * whenever that player's history happens to start. UTC keeps DST out of it.
 *
 * An unparseable date yields NaN, which compares unequal to everything - such
 * an entry is therefore kept rather than silently dropped.
 */
function bucketIndexFor(isoDate: string, bucketDays: number): number {
  const epochDay = Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000);

  return Math.floor(epochDay / bucketDays);
}

/**
 * Thins history to roughly one entry per `bucketDays`-long window, keeping the
 * latest entry in each. Charting every stored day means ~700 points per player,
 * which is both slow and unreadable - at daily resolution the lines render as
 * solid bands.
 *
 * The latest entry per window is kept rather than an average because these are
 * cumulative values: the newest entry is the window's true end state, whereas
 * averaging would flatten real training steps and can invent non-monotonic dips
 * that never happened.
 *
 * Three guarantees, which matter for players who have no gathered history and
 * only a few entries captured at arbitrary times on profile visits:
 *
 * - The first entry always survives, so a player whose only two entries share a
 *   window keeps both and still draws a line - collapsing them to one point
 *   would render a lone dot instead.
 * - The last entry always survives, so a line never stops short of the player's
 *   present-day value.
 * - Entries in distinct windows are all kept. This can only ever reduce point
 *   count, never drop a player to zero.
 *
 * Callers should filter to entries usable on the metric being plotted *before*
 * calling this - see the note at the PlayerGrowthComparisonChart call site.
 */
export function downsampleHistory(
  entries: SkillHistoryEntry[],
  bucketDays: number = CHART_BUCKET_DAYS
): SkillHistoryEntry[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (bucketDays <= 1 || sorted.length <= 2) return sorted;

  const kept: SkillHistoryEntry[] = [];
  let currentBucket: number | null = null;

  sorted.forEach((entry, index) => {
    const bucket = bucketIndexFor(entry.date, bucketDays);

    if (index === 0) {
      // Pin the series start.
      kept.push(entry);
      currentBucket = bucket;
      return;
    }

    if (bucket !== currentBucket) {
      kept.push(entry);
      currentBucket = bucket;
      return;
    }

    if (kept.length === 1) {
      // Still inside the first window: keep the pinned start as well as this,
      // so a two-entry player never collapses to a single point.
      kept.push(entry);
      return;
    }

    // A later entry in the same window supersedes the one held for it.
    kept[kept.length - 1] = entry;
  });

  return kept;
}
