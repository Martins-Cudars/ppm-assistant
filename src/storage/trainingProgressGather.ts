/**
 * Cross-reload state for the "Gather history" walk on the hockey
 * training-progress page (see src/sports/hockey/views/viewTrainingProgress.ts).
 *
 * The walk works by really following the page's own "previous month" link, so
 * it spans a full page load per month and needs somewhere to keep its running
 * totals. This uses sessionStorage rather than chrome.storage.local on purpose:
 *
 * - it is per-tab, so two tabs walking two different players cannot collide;
 * - it is synchronous, so the view can decide whether to continue the walk
 *   before it renders anything;
 * - it dies with the tab, so an abandoned half-finished walk can never
 *   resurrect days later when the page is opened again.
 *
 * Content scripts share the page origin's sessionStorage, so this is readable
 * across the reloads the walk triggers.
 */

const GATHER_SESSION_KEY = "ppm-assistant:trainingProgressGather";

/**
 * A walk left untouched for this long is treated as abandoned. Each step
 * refreshes `updatedAt`, and a step is only ever ~1s, so anything older than
 * this means the walk died (navigation elsewhere, a page error, a closed
 * dialog) and should not silently resume.
 */
const STALE_MS = 10 * 60 * 1000;

export interface GatherSession {
  playerId: string;
  /** Epoch ms when the user pressed "Gather history". */
  startedAt: number;
  /** Epoch ms of the most recent step; used for the staleness check. */
  updatedAt: number;
  monthsVisited: number;
  /**
   * How many months this walk will cover in total, fixed when it starts. It has
   * to be carried rather than recomputed per step: the walk moves the month on
   * screen backwards, so recomputing would yield the months *remaining*, not
   * the total. 0 means the page's bounds couldn't be read, in which case
   * progress is reported without a denominator.
   */
  totalMonths: number;
  entriesWritten: number;
  /** YYMM of the month captured by the previous step, as a number (e.g. 2607). */
  lastCode: number;
}

function isGatherSession(value: unknown): value is GatherSession {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.playerId === "string" &&
    typeof candidate.startedAt === "number" &&
    typeof candidate.updatedAt === "number" &&
    typeof candidate.monthsVisited === "number" &&
    typeof candidate.totalMonths === "number" &&
    typeof candidate.entriesWritten === "number" &&
    typeof candidate.lastCode === "number"
  );
}

/**
 * Returns the in-progress walk for this tab, or null if there isn't one.
 * Self-clears on malformed or stale state so a broken session can never wedge
 * the page.
 */
export function readGatherSession(): GatherSession | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(GATHER_SESSION_KEY);
  } catch (error) {
    console.error("[TrainingProgressGather] Could not read session:", error);
    return null;
  }

  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearGatherSession();
    return null;
  }

  if (!isGatherSession(parsed)) {
    clearGatherSession();
    return null;
  }

  if (Date.now() - parsed.updatedAt > STALE_MS) {
    clearGatherSession();
    return null;
  }

  return parsed;
}

export function writeGatherSession(session: GatherSession): void {
  try {
    sessionStorage.setItem(GATHER_SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error("[TrainingProgressGather] Could not persist session:", error);
  }
}

export function clearGatherSession(): void {
  try {
    sessionStorage.removeItem(GATHER_SESSION_KEY);
  } catch (error) {
    console.error("[TrainingProgressGather] Could not clear session:", error);
  }
}
