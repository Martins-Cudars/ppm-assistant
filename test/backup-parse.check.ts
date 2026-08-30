/**
 * Assertions for parseBackup() - see test/README.md for how to run these.
 *
 * These cases are the point of the file. Backup validation is load-bearing:
 * the skill-history store's keyPath is "id", so one entry without one throws
 * inside put() and aborts the whole transaction, taking every valid row with
 * it. So the envelope must be rejected outright while individual rows are
 * filtered and counted.
 *
 * All 12 passed against the compiled module on 2026-08-30.
 */

import { parseBackup } from "@/storage/backup";
import { BACKUP_FORMAT, BACKUP_VERSION } from "@/types/Backup";

let failures = 0;

const check = (name: string, fn: () => void) => {
  try {
    fn();
    console.log("PASS", name);
  } catch (e) {
    failures++;
    console.log("FAIL", name, "-", (e as Error).message);
  }
};

const eq = (a: unknown, b: unknown, m = "") => {
  if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

const throws = (fn: () => void, fragment: string) => {
  try {
    fn();
  } catch (e) {
    const message = (e as Error).message;
    if (!message.includes(fragment)) throw new Error(`wrong error: ${message}`);
    return;
  }
  throw new Error("expected a throw");
};

const entry = (playerId: string, date: string) => ({
  id: `${playerId}:${date}`,
  playerId,
  date,
  overallRating: 900,
  capturedAt: "2026-08-28T00:00:00.000Z",
  source: "PlayersList",
});

const good = {
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: "2026-08-28T10:00:00.000Z",
  extensionVersion: "3.2.0",
  playerCaches: {
    "ppm-assistant:hockey:team-1": {
      players: { a: {} },
      teamId: "1",
      currentSeasonDay: 5,
      lastModified: "x",
    },
  },
  skillHistory: [entry("111", "2026-08-27"), entry("111", "2026-08-28")],
};

check("accepts a valid backup", () => {
  const r = parseBackup(JSON.stringify(good));
  eq(r.backup.skillHistory.length, 2, "entries");
  eq(r.skippedEntries, 0, "skipped");
  eq(Object.keys(r.backup.playerCaches).length, 1, "caches");
});

check("rejects non-JSON", () => throws(() => parseBackup("not json"), "valid JSON"));
check("rejects foreign JSON", () =>
  throws(() => parseBackup('{"hello":1}'), "isn't a PPM Assistant backup"));
check("rejects null", () => throws(() => parseBackup("null"), "isn't a PPM Assistant backup"));
check("rejects an array", () => throws(() => parseBackup("[]"), "isn't a PPM Assistant backup"));
check("rejects an unknown version", () =>
  throws(() => parseBackup(JSON.stringify({ ...good, version: 99 })), "isn't supported"));

// The row-level cases below are the ones that matter most: each of these would
// abort the import transaction if it reached the worker.
check("drops entries with no id", () => {
  const bad = {
    ...good,
    skillHistory: [entry("111", "2026-08-27"), { playerId: "1", date: "2026-08-28" }],
  };
  const r = parseBackup(JSON.stringify(bad));
  eq(r.backup.skillHistory.length, 1, "kept");
  eq(r.skippedEntries, 1, "skipped");
});

check("drops entries whose id disagrees with playerId:date", () => {
  // Would land under the wrong key and break getSummaries(), which derives
  // player and date from the key alone.
  const bad = {
    ...good,
    skillHistory: [{ ...entry("111", "2026-08-27"), id: "999:2026-08-27" }],
  };
  const r = parseBackup(JSON.stringify(bad));
  eq(r.backup.skillHistory.length, 0, "kept");
  eq(r.skippedEntries, 1, "skipped");
});

check("drops entries with a malformed date", () => {
  const bad = {
    ...good,
    skillHistory: [{ id: "111:27-08-2026", playerId: "111", date: "27-08-2026" }],
  };
  eq(parseBackup(JSON.stringify(bad)).skippedEntries, 1, "skipped");
});

check("drops null entries without throwing", () => {
  const bad = { ...good, skillHistory: [null, entry("111", "2026-08-27")] };
  const r = parseBackup(JSON.stringify(bad));
  eq(r.backup.skillHistory.length, 1, "kept");
  eq(r.skippedEntries, 1, "skipped");
});

check("drops caches with no players map", () => {
  const bad = { ...good, playerCaches: { k1: { teamId: "1" }, k2: { players: {} } } };
  const r = parseBackup(JSON.stringify(bad));
  eq(Object.keys(r.backup.playerCaches).length, 1, "kept");
  eq(r.skippedCaches, 1, "skipped");
});

check("tolerates missing optional envelope fields", () => {
  const r = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION }));
  eq(r.backup.skillHistory.length, 0, "entries");
  eq(r.backup.extensionVersion, "unknown", "version");
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
