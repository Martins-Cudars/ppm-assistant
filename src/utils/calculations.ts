/**
 * Generic calculation utilities
 * Pure functions with no DOM dependencies
 */

/**
 * Calculate season progress as a ratio (0-1)
 * @param seasonDay - Current day in season (1-112)
 * @returns Progress ratio (0 at start, 1 at end)
 */
export function calculateSeasonProgress(seasonDay: number): number {
  return seasonDay / 112;
}

// Note: Sport-specific calculations move to sport directories
