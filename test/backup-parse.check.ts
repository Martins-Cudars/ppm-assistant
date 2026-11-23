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

import {
  fileLeagueList,
  parseBackup,
  readLeagueListsForBackup,
  restoreLeagueList,
} from "@/storage/backup";
import type { LeagueTeams } from "@/types/ScoutSnapshot";
import type { Sport } from "@/types/Sport";
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

check("league lists the export couldn't read: kept from the file; unknown sports dropped", () => {
  const r = parseBackup(JSON.stringify({ ...good, leaguesSkipped: ["soccer", "curling", 3] }));
  eq(JSON.stringify(r.backup.leaguesSkipped), JSON.stringify(["soccer"]));
  eq(parseBackup(JSON.stringify(good)).backup.leaguesSkipped, undefined, "older files have none");
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

// --- Version 2: per-sport history ------------------------------------------------

check("a version 1 file still imports, with no other sports", () => {
  const r = parseBackup(JSON.stringify({ ...good, version: 1 }));
  eq(r.backup.skillHistory.length, 2, "hockey history kept");
  eq(r.backup.sportSkillHistory?.basketball?.length, 0, "no basketball");
});

check("basketball history is read and filtered like hockey's", () => {
  const v2 = {
    ...good,
    version: 2,
    sportSkillHistory: {
      basketball: [
        { ...entry("777", "2026-09-01"), height: 201, experience: 12 },
        { playerId: "777", date: "2026-09-02" }, // no id - would abort the write
      ],
    },
  };
  const r = parseBackup(JSON.stringify(v2));
  eq(r.backup.sportSkillHistory?.basketball?.length, 1, "valid row kept");
  eq(r.skippedEntries, 1, "bad row counted with hockey's");
  eq(r.backup.skillHistory.length, 2, "hockey untouched");
});

// League lists: a list that can't be read is never taken as "no list". The
// backup leaves it out and names the sport; a merge restore leaves the stored
// one as it is and carries on.
{
  const list = (updatedAt: string): LeagueTeams => ({
    season: 58, leagueId: "lva-ii-4", leagueName: "II.4", teamIds: ["t1"], updatedAt,
  });
  const failing = async (sport: Sport): Promise<LeagueTeams | null> => {
    if (sport === "soccer") throw new Error("storage unavailable");
    return sport === "hockey" ? list("2026-11-01") : null;
  };
  const store = (stored: (sport: Sport) => Promise<LeagueTeams | null>) => {
    const saved: string[] = [];
    const cleared: string[] = [];
    return {
      saved,
      cleared,
      load: stored,
      save: async (_league: LeagueTeams, sport: Sport) => void saved.push(sport),
      clear: async (sport: Sport) => void cleared.push(sport),
    };
  };
  const asyncChecks: [string, () => Promise<void>][] = [
    [
      "backup: an unreadable league list is left out and named; the others are kept",
      async () => {
        const { leagues, skipped } = await readLeagueListsForBackup(failing);
        eq(JSON.stringify(skipped), JSON.stringify(["soccer"]), "skipped");
        eq(leagues.hockey?.updatedAt, "2026-11-01", "hockey kept");
        eq("soccer" in leagues, false, "soccer left out");
        eq("basketball" in leagues, false, "no list stored");
      },
    ],
    [
      "restore (merge): an unreadable stored list is skipped, not overwritten",
      async () => {
        const io = store(failing);
        eq(await restoreLeagueList("soccer", list("2026-11-20"), "merge", io), "skipped");
        eq(io.saved.length, 0, "nothing saved");
      },
    ],
    [
      "restore (merge): the newer list wins; no stored list takes the file's",
      async () => {
        const io = store(failing);
        eq(await restoreLeagueList("hockey", list("2026-10-01"), "merge", io), "kept", "stored is newer");
        eq(await restoreLeagueList("hockey", list("2026-11-20"), "merge", io), "saved", "file is newer");
        eq(await restoreLeagueList("basketball", list("2026-10-01"), "merge", io), "saved", "none stored");
        eq(await restoreLeagueList("basketball", undefined, "merge", io), "unchanged", "none in the file");
        eq(JSON.stringify(io.saved), JSON.stringify(["hockey", "basketball"]));
      },
    ],
    [
      "restore (replace): the file's list is written without reading the stored one",
      async () => {
        const io = store(failing);
        eq(await restoreLeagueList("soccer", list("2026-10-01"), "replace", io), "saved");
        eq(await restoreLeagueList("hockey", undefined, "replace", io), "cleared");
        eq(JSON.stringify([io.saved, io.cleared]), JSON.stringify([["soccer"], ["hockey"]]));
      },
    ],
    [
      "restore: a list the export couldn't read leaves the stored one alone, in both modes",
      async () => {
        const io = store(failing);
        const file = { leagues: { hockey: list("2026-11-20") }, leaguesSkipped: ["soccer" as Sport] };
        eq(await restoreLeagueList("soccer", fileLeagueList(file, "soccer"), "replace", io), "unchanged", "replace");
        eq(await restoreLeagueList("soccer", fileLeagueList(file, "soccer"), "merge", io), "unchanged", "merge");
        eq(await restoreLeagueList("basketball", fileLeagueList(file, "basketball"), "replace", io), "cleared");
        eq(JSON.stringify([io.saved, io.cleared]), JSON.stringify([[], ["basketball"]]), "soccer untouched");
      },
    ],
  ];
  const quiet = console.error;
  console.error = () => {};
  for (const [name, fn] of asyncChecks) {
    try {
      await fn();
      console.log("PASS", name);
    } catch (e) {
      failures++;
      console.log("FAIL", name, "-", (e as Error).message);
    }
  }
  console.error = quiet;
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
