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
import { SPORTS, Sport, historyStoreName } from "@/types/Sport";
import { publicAccountCacheKeys } from "@/storage/publicAccount";

const DB_NAME = "ppm-assistant-skill-history";
/**
 * 2 added one object store per sport beside hockey's original "skillHistory";
 * 3 added soccer's. The upgrade only ever creates missing stores - it never
 * touches existing data - so no sport's history needed a migration.
 */
const DB_VERSION = 3;
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
      SPORTS.forEach((sport) => {
        const name = historyStoreName(sport);
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: "id" });
          store.createIndex(PLAYER_INDEX, "playerId", { unique: false });
        }
      });
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
  existing: SkillHistoryEntry<unknown> | undefined,
  incoming: SkillHistoryEntry<unknown>
): SkillHistoryEntry<unknown> {
  if (!existing) return incoming;

  return {
    ...existing,
    ...incoming,
    overallRating: incoming.overallRating ?? existing.overallRating ?? existing.kr,
    skills: incoming.skills ?? existing.skills,
    height: incoming.height ?? existing.height,
    experience: incoming.experience ?? existing.experience,
  };
}

async function upsertEntries(
  entries: SkillHistoryEntry<unknown>[],
  sport: Sport
): Promise<number> {
  if (entries.length === 0) {
    return 0;
  }

  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(historyStoreName(sport), "readwrite");
    const store = tx.objectStore(historyStoreName(sport));

    entries.forEach((entry) => {
      const existingRequest = store.get(entry.id);
      existingRequest.onsuccess = () => {
        store.put(
          mergeEntry(existingRequest.result as SkillHistoryEntry<unknown> | undefined, entry)
        );
      };
    });

    tx.oncomplete = () => resolve(entries.length);
    tx.onerror = () => reject(tx.error);
  });
}

async function getEntriesForPlayer(playerId: string, sport: Sport): Promise<SkillHistoryEntry[]> {
  const db = await openDb();

  const entries = await new Promise<SkillHistoryEntry[]>((resolve, reject) => {
    const tx = db.transaction(historyStoreName(sport), "readonly");
    const store = tx.objectStore(historyStoreName(sport));
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
 * Splits an entry key back into its player and date, or null for a key that
 * isn't `${playerId}:${date}`.
 */
function parseEntryKey(key: IDBValidKey): { playerId: string; date: string } | null {
  if (typeof key !== "string") return null;
  // Split on the first ":" only - the date part contains none, and this
  // stays correct if a player id ever gains one.
  const separator = key.indexOf(":");
  if (separator <= 0) return null;

  const date = key.slice(separator + 1);
  if (date.length !== 10) return null;

  return { playerId: key.slice(0, separator), date };
}

/**
 * Coverage for every player in the store, in one pass.
 *
 * Reads only the primary keys, never the records: entry ids are
 * `${playerId}:${date}`, so the player, the day count and the date range all
 * fall out of the key set. That keeps summarising a whole squad cheap even
 * when each player holds hundreds of days.
 */
async function getSummaries(sport: Sport): Promise<SkillHistorySummary[]> {
  const db = await openDb();

  const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
    const tx = db.transaction(historyStoreName(sport), "readonly");
    const request = tx.objectStore(historyStoreName(sport)).getAllKeys();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const totals = new Map<string, { days: number; firstDate: string; lastDate: string }>();

  keys.forEach((key) => {
    const parsed = parseEntryKey(key);
    if (!parsed) return;
    const { playerId, date } = parsed;

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

type ParsedKey = { key: IDBValidKey; playerId: string; date: string };

/**
 * Reads only the records whose keys `select` picks, in one read-only
 * transaction. The keys are read first - cheap, as in getSummaries() - so a
 * caller that needs a few weeks per player never pays for the whole store.
 */
async function getEntriesForSelectedKeys(
  select: (keys: ParsedKey[]) => ParsedKey[],
  sport: Sport
): Promise<SkillHistoryEntry[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(historyStoreName(sport), "readonly");
    const store = tx.objectStore(historyStoreName(sport));
    const entries: SkillHistoryEntry[] = [];

    const keysRequest = store.getAllKeys();
    keysRequest.onsuccess = () => {
      const parsed = keysRequest.result.flatMap((key) => {
        const parts = parseEntryKey(key);
        return parts ? [{ key, ...parts }] : [];
      });

      select(parsed).forEach(({ key }) => {
        const request = store.get(key);
        request.onsuccess = () => {
          if (request.result) entries.push(request.result as SkillHistoryEntry);
        };
      });
    };

    tx.oncomplete = () => resolve(entries);
    tx.onerror = () => reject(tx.error);
    // An abort with no request error would otherwise leave the caller hanging.
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

/**
 * Each player's entries from the last `days` before their own latest stored
 * day. Anchoring on each player's latest day rather than today means a player
 * last seen a while ago still returns the weeks before that sighting.
 */
function getLatestWindowEntries(days: number, sport: Sport): Promise<SkillHistoryEntry[]> {
  return getEntriesForSelectedKeys((keys) => {
    const latest = new Map<string, string>();
    keys.forEach(({ playerId, date }) => {
      const current = latest.get(playerId);
      if (!current || date > current) latest.set(playerId, date);
    });

    return keys.filter(({ playerId, date }) => daysBetween(date, latest.get(playerId)!) <= days);
  }, sport);
}

/**
 * The target players' entries within `days` either side of each one's target
 * date - e.g. around the day each turned 25.
 */
function getEntriesNearDates(
  targets: { playerId: string; date: string }[],
  days: number,
  sport: Sport
): Promise<SkillHistoryEntry[]> {
  const targetDates = new Map(targets.map(({ playerId, date }) => [playerId, date]));

  return getEntriesForSelectedKeys((keys) =>
    keys.filter(({ playerId, date }) => {
      const target = targetDates.get(playerId);
      return target !== undefined && Math.abs(daysBetween(target, date)) <= days;
    }),
    sport
  );
}

/**
 * Every record in the store. The expensive read - shared by the two callers
 * that genuinely need values rather than keys: the footprint measurement and
 * the backup export.
 */
async function getAllEntries(sport: Sport): Promise<SkillHistoryEntry[]> {
  const db = await openDb();

  return new Promise<SkillHistoryEntry[]>((resolve, reject) => {
    const tx = db.transaction(historyStoreName(sport), "readonly");
    const request = tx.objectStore(historyStoreName(sport)).getAll();

    request.onsuccess = () => resolve(request.result as SkillHistoryEntry[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Storage footprint of the whole store.
 *
 * Unlike getSummaries(), this deliberately reads every record - measuring size
 * is the entire point, so the key-only shortcut doesn't apply. One getAll() per
 * call, so keep it to places that actually display the numbers.
 */
async function getStats(sport: Sport): Promise<SkillHistoryStats> {
  const entries = await getAllEntries(sport);

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
async function clearEntries(sport: Sport): Promise<number> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(historyStoreName(sport), "readwrite");
    const store = tx.objectStore(historyStoreName(sport));
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

/**
 * Deletes every stored day of the given players from a sport's store, in one
 * transaction. Entries are keyed `${playerId}:${date}`, so each player is one
 * key range. Returns how many entries went.
 */
async function deleteEntriesForPlayers(playerIds: string[], sport: Sport): Promise<number> {
  if (playerIds.length === 0) return 0;
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(historyStoreName(sport), "readwrite");
    const store = tx.objectStore(historyStoreName(sport));
    let removed = 0;

    playerIds.forEach((playerId) => {
      const range = IDBKeyRange.bound(`${playerId}:`, `${playerId}:￿`);
      const countRequest = store.count(range);
      countRequest.onsuccess = () => {
        removed += countRequest.result;
        store.delete(range);
      };
    });

    tx.oncomplete = () => resolve(removed);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Removes what the extension stored from the game's logged-out "Public
 * account" demo team before it learned to ignore it (src/main.ts now skips
 * those pages): the team cache, and every history day of its players. Runs
 * whenever the worker starts; once clean it finds nothing and does nothing.
 *
 * Safe to delete by player id: a demo-team player is never on the user's team.
 */
async function purgePublicAccountData(): Promise<void> {
  const allData = await chrome.storage.local.get(null);
  for (const sport of SPORTS) {
    const keys = publicAccountCacheKeys(allData, sport);
    if (keys.length === 0) continue;
    const playerIds = keys.flatMap((key) =>
      Object.keys((allData[key] as { players?: Record<string, unknown> } | undefined)?.players ?? {})
    );
    const removed = await deleteEntriesForPlayers(playerIds, sport);
    await chrome.storage.local.remove(keys);
    console.log(
      `[Background] Removed public-account data (${sport}): ${keys.join(", ")}, ` +
        `${playerIds.length} players, ${removed} history entries`
    );
  }
}

purgePublicAccountData().catch((error) => {
  console.error("[Background] Public-account cleanup failed:", error);
});

chrome.runtime.onMessage.addListener(
  (message: SkillHistoryMessage, _sender, sendResponse: (response: SkillHistoryResponse) => void) => {
    // Messages from before basketball carry no sport; they're hockey's.
    const sport: Sport = message.sport ?? "hockey";

    if (message.type === "SKILL_HISTORY_UPSERT") {
      upsertEntries(message.entries, sport)
        .then((written) => sendResponse({ type: "SKILL_HISTORY_UPSERT", written }))
        .catch((error) => {
          console.error("[Background] Failed to upsert skill history:", error);
          sendResponse({ type: "SKILL_HISTORY_UPSERT", written: 0 });
        });
      return true;
    }

    if (message.type === "SKILL_HISTORY_GET") {
      getEntriesForPlayer(message.playerId, sport)
        .then((entries) => sendResponse({ type: "SKILL_HISTORY_GET", entries }))
        .catch((error) => {
          console.error("[Background] Failed to load skill history:", error);
          sendResponse({ type: "SKILL_HISTORY_GET", entries: [] });
        });
      return true;
    }

    if (message.type === "SKILL_HISTORY_SUMMARY") {
      getSummaries(sport)
        .then((summaries) => sendResponse({ type: "SKILL_HISTORY_SUMMARY", summaries }))
        .catch((error) => {
          console.error("[Background] Failed to summarise skill history:", error);
          sendResponse({ type: "SKILL_HISTORY_SUMMARY", summaries: [] });
        });
      return true;
    }

    if (message.type === "SKILL_HISTORY_STATS") {
      getStats(sport)
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
      clearEntries(sport)
        .then((cleared) => sendResponse({ type: "SKILL_HISTORY_CLEAR", cleared }))
        .catch((error) => {
          console.error("[Background] Failed to clear skill history:", error);
          // null, not 0 - see the note on the response type.
          sendResponse({ type: "SKILL_HISTORY_CLEAR", cleared: null });
        });
      return true;
    }

    if (message.type === "SKILL_HISTORY_EXPORT") {
      getAllEntries(sport)
        .then((entries) => sendResponse({ type: "SKILL_HISTORY_EXPORT", entries }))
        .catch((error) => {
          console.error("[Background] Failed to export skill history:", error);
          // null, not [] - see the note on the response type.
          sendResponse({ type: "SKILL_HISTORY_EXPORT", entries: null });
        });
      return true;
    }

    if (message.type === "SKILL_HISTORY_LATEST_WINDOW") {
      getLatestWindowEntries(message.days, sport)
        .then((entries) => sendResponse({ type: "SKILL_HISTORY_LATEST_WINDOW", entries }))
        .catch((error) => {
          console.error("[Background] Failed to read recent skill history:", error);
          // null, not [] - see the note on the response type.
          sendResponse({ type: "SKILL_HISTORY_LATEST_WINDOW", entries: null });
        });
      return true;
    }

    if (message.type === "SKILL_HISTORY_NEAR_DATES") {
      getEntriesNearDates(message.targets, message.days, sport)
        .then((entries) => sendResponse({ type: "SKILL_HISTORY_NEAR_DATES", entries }))
        .catch((error) => {
          console.error("[Background] Failed to read skill history near dates:", error);
          // null, not [] - see the note on the response type.
          sendResponse({ type: "SKILL_HISTORY_NEAR_DATES", entries: null });
        });
      return true;
    }

    return false;
  }
);
