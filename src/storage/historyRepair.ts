/**
 * Repairs for history entries stored by earlier, buggy versions. Pure, so the
 * background worker can apply them and the checks can test them.
 */

/** Storage flag: the truncated-OR repair has run. */
export const OR_THOUSANDS_REPAIR_FLAG = "ppm-assistant:migrations:or-thousands-v1";

type Repairable = { overallRating?: number; skills?: Record<string, number> };

/**
 * The corrected OR for an entry whose OR was cut at an English thousands
 * comma ("1,598" read as 1), or null when the entry is fine.
 *
 * OR is exactly the sum of the floored skills - true on every other stored
 * day in all three sports (hockey 19,307, basketball 10,198, soccer 12,787) -
 * so the true value is recoverable. Only entries that are unmistakably cut
 * are touched: a single-digit OR where the skills add up to 1000 or more.
 */
export function repairedOverallRating(entry: Repairable): number | null {
  if (!entry.skills || typeof entry.overallRating !== "number") return null;
  const sum = Object.values(entry.skills).reduce((total, value) => total + Math.floor(value), 0);
  return entry.overallRating < 10 && sum >= 1000 ? sum : null;
}
