/**
 * Team cache key shapes, with no dependencies - so modules the DOM helpers
 * import (e.g. publicAccount.ts) can use them without an import cycle.
 * storageKeys.ts re-exports both.
 */

import { SPORTS, Sport } from "@/types/Sport";

/** The prefix every team cache key of a sport shares. */
export function teamPrefix(sport: Sport): string {
  return `ppm-assistant:${sport}:team-`;
}

/** Whether a storage key is any sport's team cache. */
export function isTeamCacheKey(key: string): boolean {
  return SPORTS.some((sport) => key.startsWith(teamPrefix(sport)));
}
