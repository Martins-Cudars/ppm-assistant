/**
 * Message contract between the client-side skill-history API
 * (src/storage/skillHistoryDb.ts, callable from any extension context) and
 * the background service worker (src/background.ts), which owns the actual
 * IndexedDB database. Needed because IndexedDB is isolated per-origin, and
 * the extension's own pages (e.g. player-report.html) run under a different
 * origin than the game pages that capture the data - routing both through
 * the background worker's own origin makes the data reachable from anywhere.
 */

import { SkillHistoryEntry } from "@/types/SkillHistory";

export type SkillHistoryMessage =
  | { type: "SKILL_HISTORY_UPSERT"; entries: SkillHistoryEntry[] }
  | { type: "SKILL_HISTORY_GET"; playerId: string };

export type SkillHistoryResponse =
  | { type: "SKILL_HISTORY_UPSERT"; written: number }
  | { type: "SKILL_HISTORY_GET"; entries: SkillHistoryEntry[] };
