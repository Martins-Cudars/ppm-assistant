/**
 * Thinning daily history for charts - shared by every sport. Only dates are
 * read, so it works on any history entry type.
 */

/**
 * Default charting window. 14 days gives 8 points per 112-day hockey season (5 per 70-day basketball one), which is
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
 * calling this - see the comparison series in the Player Reports.
 */
export function downsampleHistory<T extends { date: string }>(
  entries: T[],
  bucketDays: number = CHART_BUCKET_DAYS
): T[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (bucketDays <= 1 || sorted.length <= 2) return sorted;

  const kept: T[] = [];
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
