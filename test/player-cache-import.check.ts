/**
 * Assertions for importCaches() and exportAllCaches() - see test/README.md.
 *
 * The last two cases are the ones worth keeping above all: importCaches() must
 * write the file's own key strings, because every other write path in
 * playerCache.ts goes through generateStorageKey(), which reads the team id out
 * of the game DOM. That DOM does not exist on player-report.html, where a
 * restore runs, so following the module's convention would funnel the whole
 * restore into "team-unknown" - a key clearInvalidCaches() deletes on the next
 * game page visit.
 *
 * All 8 passed against the compiled module on 2026-08-30.
 */

// chrome.storage.local has to exist before the module under test is imported,
// hence the stub-then-dynamic-import rather than a static import at the top.
const store: Record<string, unknown> = {};
(globalThis as Record<string, unknown>).chrome = {
  storage: {
    local: {
      get: async (k: unknown) => (k === null ? { ...store } : {}),
      set: async (obj: Record<string, unknown>) => {
        Object.assign(store, obj);
      },
      remove: async (keys: string[]) => {
        keys.forEach((k) => delete store[k]);
      },
    },
  },
};

const { importCaches, exportAllCaches } = await import("@/storage/playerCache");

let failures = 0;

const check = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
    console.log("PASS", name);
  } catch (e) {
    failures++;
    console.log("FAIL", name, "-", (e as Error).message);
  }
};

const eq = (a: unknown, b: unknown, m = "") => {
  if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

const reset = (init: Record<string, unknown> = {}) => {
  Object.keys(store).forEach((k) => delete store[k]);
  Object.assign(store, init);
};

const player = (updatedAt: string, or: number) =>
  ({ baseInfo: { overallRating: or }, metadata: { updatedAt } }) as never;

const cache = (players: Record<string, unknown>, lastModified = "2026-01-01") =>
  ({ players, teamId: "1", currentSeasonDay: 5, lastModified }) as never;

type Players = Record<string, { baseInfo: { overallRating: number } }>;
const playersOf = (key: string) => (store[key] as never as { players: Players }).players;

const KEY = "ppm-assistant:hockey:team-1";
const OTHER = "ppm-assistant:hockey:team-2";

await check("merge keeps the newer copy of a player", async () => {
  reset({ [KEY]: cache({ p1: player("2026-08-28T00:00:00Z", 900) }) });
  await importCaches({ [KEY]: cache({ p1: player("2026-08-01T00:00:00Z", 800) }) }, "merge");
  eq(playersOf(KEY).p1.baseInfo.overallRating, 900, "stale import must not win");
});

await check("merge takes the file's copy when it is newer", async () => {
  reset({ [KEY]: cache({ p1: player("2026-08-01T00:00:00Z", 800) }) });
  await importCaches({ [KEY]: cache({ p1: player("2026-08-28T00:00:00Z", 900) }) }, "merge");
  eq(playersOf(KEY).p1.baseInfo.overallRating, 900, "newer import must win");
});

await check("merge unions players across both sides", async () => {
  reset({ [KEY]: cache({ p1: player("2026-08-01T00:00:00Z", 800) }) });
  await importCaches({ [KEY]: cache({ p2: player("2026-08-01T00:00:00Z", 700) }) }, "merge");
  eq(Object.keys(playersOf(KEY)).length, 2, "union");
});

await check("merge leaves cache keys absent from the file alone", async () => {
  reset({
    [KEY]: cache({ p1: player("2026-08-01T00:00:00Z", 800) }),
    [OTHER]: cache({ p9: player("2026-08-01T00:00:00Z", 600) }),
  });
  await importCaches({ [KEY]: cache({ p1: player("2026-08-02T00:00:00Z", 810) }) }, "merge");
  eq(OTHER in store, true, "other team's cache must survive a merge");
});

await check("replace drops cache keys absent from the file", async () => {
  reset({
    [KEY]: cache({ p1: player("2026-08-01T00:00:00Z", 800) }),
    [OTHER]: cache({ p9: player("2026-08-01T00:00:00Z", 600) }),
  });
  await importCaches({ [KEY]: cache({ p1: player("2026-08-02T00:00:00Z", 810) }) }, "replace");
  eq(OTHER in store, false, "stale key must go");
  eq(KEY in store, true, "restored key must stay");
});

await check("replace overwrites rather than merging players", async () => {
  reset({
    [KEY]: cache({
      p1: player("2026-08-28T00:00:00Z", 900),
      p2: player("2026-08-28T00:00:00Z", 950),
    }),
  });
  await importCaches({ [KEY]: cache({ p1: player("2026-08-01T00:00:00Z", 800) }) }, "replace");
  eq(Object.keys(playersOf(KEY)).length, 1, "file wins outright");
  eq(playersOf(KEY).p1.baseInfo.overallRating, 800, "even when older");
});

await check("import writes each key from the file, not a DOM-derived key", async () => {
  reset({});
  await importCaches({ [KEY]: cache({ p1: player("2026-08-01T00:00:00Z", 800) }) }, "replace");
  eq(KEY in store, true, "must use the file's key");
  eq("ppm-assistant:hockey:team-unknown" in store, false, "must not fall back to team-unknown");
});

await check("export skips team-unknown caches", async () => {
  reset({
    [KEY]: cache({ p1: player("2026-08-01T00:00:00Z", 800) }),
    "ppm-assistant:hockey:team-unknown": cache({ p9: player("2026-08-01T00:00:00Z", 1) }),
  });
  const out = await exportAllCaches();
  eq(Object.keys(out).length, 1, "count");
  eq(KEY in out, true, "real key kept");
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
