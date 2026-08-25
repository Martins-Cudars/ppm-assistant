/**
 * Background service worker. Owns the skill-history IndexedDB database so
 * it's reachable from a single, consistent origin (chrome-extension://<id>)
 * regardless of which extension surface - a content script on the game's
 * pages, or the standalone player-report.html page - is asking for it.
 *
 * See src/types/SkillHistoryMessages.ts for the message contract and
 * src/storage/skillHistoryDb.ts for the client-side wrapper that sends
 * these messages.
 */

import { SkillHistoryEntry, SkillHistorySummary } from "@/types/SkillHistory";
import { SkillHistoryMessage, SkillHistoryResponse } from "@/types/SkillHistoryMessages";

const DB_NAME = "ppm-assistant-skill-history";
const DB_VERSION = 1;
const STORE_NAME = "skillHistory";
const PLAYER_INDEX = "by_playerId";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex(PLAYER_INDEX, "playerId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Combines an incoming entry with whatever is already stored for that
 * player/day. The two capture paths each supply only part of an entry - the
 * training progress page has skills, the profile of an unscouted opponent has
 * only an overall rating - and they can land on the same key, so a plain put()
 * would let whichever ran last erase the other's fields.
 *
 * Incoming values win where present; existing values survive where the
 * incoming entry has nothing to say.
 */
function mergeEntry(
  existing: SkillHistoryEntry | undefined,
  incoming: SkillHistoryEntry
): SkillHistoryEntry {
  if (!existing) return incoming;

  return {
    ...existing,
    ...incoming,
    overallRating: incoming.overallRating ?? existing.overallRating ?? existing.kr,
    skills: incoming.skills ?? existing.skills,
  };
}

async function upsertEntries(entries: SkillHistoryEntry[]): Promise<number> {
  if (entries.length === 0) {
    return 0;
  }

  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    entries.forEach((entry) => {
      const existingRequest = store.get(entry.id);
      existingRequest.onsuccess = () => {
        store.put(mergeEntry(existingRequest.result as SkillHistoryEntry | undefined, entry));
      };
    });

    tx.oncomplete = () => resolve(entries.length);
    tx.onerror = () => reject(tx.error);
  });
}

async function getEntriesForPlayer(playerId: string): Promise<SkillHistoryEntry[]> {
  const db = await openDb();

  const entries = await new Promise<SkillHistoryEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index(PLAYER_INDEX);
    const request = index.getAll(IDBKeyRange.only(playerId));

    request.onsuccess = () => resolve(request.result as SkillHistoryEntry[]);
    request.onerror = () => reject(request.error);
  });

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

/** Whole days between two ISO dates. UTC arithmetic, so DST can't skew it. */
function daysBetween(fromIso: string, toIso: string): number {
  const [fromYear, fromMonth, fromDay] = fromIso.split("-").map(Number);
  const [toYear, toMonth, toDay] = toIso.split("-").map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((to - from) / 86400000);
}

/**
 * Coverage for every player in the store, in one pass.
 *
 * Reads only the primary keys, never the records: entry ids are
 * `${playerId}:${date}`, so the player, the day count and the date range all
 * fall out of the key set. That keeps summarising a whole squad cheap even
 * when each player holds hundreds of days.
 */
async function getSummaries(): Promise<SkillHistorySummary[]> {
  const db = await openDb();

  const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAllKeys();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const totals = new Map<string, { days: number; firstDate: string; lastDate: string }>();

  keys.forEach((key) => {
    if (typeof key !== "string") return;
    // Split on the first ":" only - the date part contains none, and this
    // stays correct if a player id ever gains one.
    const separator = key.indexOf(":");
    if (separator <= 0) return;

    const playerId = key.slice(0, separator);
    const date = key.slice(separator + 1);
    if (date.length !== 10) return;

    const existing = totals.get(playerId);
    if (!existing) {
      totals.set(playerId, { days: 1, firstDate: date, lastDate: date });
      return;
    }

    existing.days += 1;
    // ISO dates sort correctly as strings, so no Date objects needed here.
    if (date < existing.firstDate) existing.firstDate = date;
    if (date > existing.lastDate) existing.lastDate = date;
  });

  return [...totals.entries()].map(([playerId, { days, firstDate, lastDate }]) => ({
    playerId,
    days,
    firstDate,
    lastDate,
    missingDays: daysBetween(firstDate, lastDate) + 1 - days,
  }));
}

chrome.runtime.onMessage.addListener(
  (message: SkillHistoryMessage, _sender, sendResponse: (response: SkillHistoryResponse) => void) => {
    if (message.type === "SKILL_HISTORY_UPSERT") {
      upsertEntries(message.entries)
        .then((written) => sendResponse({ type: "SKILL_HISTORY_UPSERT", written }))
        .catch((error) => {
          console.error("[Background] Failed to upsert skill history:", error);
          sendResponse({ type: "SKILL_HISTORY_UPSERT", written: 0 });
        });
      return true;
    }

    if (message.type === "SKILL_HISTORY_GET") {
      getEntriesForPlayer(message.playerId)
        .then((entries) => sendResponse({ type: "SKILL_HISTORY_GET", entries }))
        .catch((error) => {
          console.error("[Background] Failed to load skill history:", error);
          sendResponse({ type: "SKILL_HISTORY_GET", entries: [] });
        });
      return true;
    }

    if (message.type === "SKILL_HISTORY_SUMMARY") {
      getSummaries()
        .then((summaries) => sendResponse({ type: "SKILL_HISTORY_SUMMARY", summaries }))
        .catch((error) => {
          console.error("[Background] Failed to summarise skill history:", error);
          sendResponse({ type: "SKILL_HISTORY_SUMMARY", summaries: [] });
        });
      return true;
    }

    return false;
  }
);
