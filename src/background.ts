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

import {
  SkillHistoryEntry,
  SkillHistoryStats,
  SkillHistorySummary,
} from "@/types/SkillHistory";
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

/**
 * Storage footprint of the whole store.
 *
 * Unlike getSummaries(), this deliberately reads every record - measuring size
 * is the entire point, so the key-only shortcut doesn't apply. One getAll() per
 * call, so keep it to places that actually display the numbers.
 */
/**
 * Every record in the store. The expensive read - shared by the two callers
 * that genuinely need values rather than keys: the footprint measurement and
 * the backup export.
 */
async function getAllEntries(): Promise<SkillHistoryEntry[]> {
  const db = await openDb();

  return new Promise<SkillHistoryEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => resolve(request.result as SkillHistoryEntry[]);
    request.onerror = () => reject(request.error);
  });
}

async function getStats(): Promise<SkillHistoryStats> {
  const entries = await getAllEntries();

  const players = new Set<string>();
  let jsonBytes = 0;

  entries.forEach((entry) => {
    players.add(entry.playerId);
    // Every stored value is ASCII - numeric ids, ISO dates, skill numbers and
    // the two source literals - so .length is the UTF-8 byte count and there's
    // no need to run a TextEncoder over each record.
    jsonBytes += JSON.stringify(entry).length;
  });

  let originBytes: number | undefined;
  try {
    originBytes = (await navigator.storage?.estimate())?.usage;
  } catch {
    // Quota reporting is best-effort; the measured size stands without it.
  }

  return { records: entries.length, players: players.size, jsonBytes, originBytes };
}

/**
 * Empties the store, resolving the number of records removed.
 *
 * count() and clear() share one transaction so the number reported is the
 * number actually removed, rather than a count that a concurrent capture
 * could have changed between two separate transactions.
 */
async function clearEntries(): Promise<number> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    let cleared = 0;

    const countRequest = store.count();
    countRequest.onsuccess = () => {
      cleared = countRequest.result;
      store.clear();
    };

    tx.oncomplete = () => resolve(cleared);
    tx.onerror = () => reject(tx.error);
  });
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

    if (message.type === "SKILL_HISTORY_STATS") {
      getStats()
        .then((stats) => sendResponse({ type: "SKILL_HISTORY_STATS", stats }))
        .catch((error) => {
          console.error("[Background] Failed to measure skill history:", error);
          sendResponse({
            type: "SKILL_HISTORY_STATS",
            stats: { records: 0, players: 0, jsonBytes: 0 },
          });
        });
      return true;
    }

    if (message.type === "SKILL_HISTORY_CLEAR") {
      clearEntries()
        .then((cleared) => sendResponse({ type: "SKILL_HISTORY_CLEAR", cleared }))
        .catch((error) => {
          console.error("[Background] Failed to clear skill history:", error);
          // null, not 0 - see the note on the response type.
          sendResponse({ type: "SKILL_HISTORY_CLEAR", cleared: null });
        });
      return true;
    }

    if (message.type === "SKILL_HISTORY_EXPORT") {
      getAllEntries()
        .then((entries) => sendResponse({ type: "SKILL_HISTORY_EXPORT", entries }))
        .catch((error) => {
          console.error("[Background] Failed to export skill history:", error);
          // null, not [] - see the note on the response type.
          sendResponse({ type: "SKILL_HISTORY_EXPORT", entries: null });
        });
      return true;
    }

    return false;
  }
);
