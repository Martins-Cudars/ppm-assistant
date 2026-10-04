/**
 * Assertions for storage/historyQueries.ts - what the Player Reports work out
 * from their one full history read instead of asking the worker again. Each
 * function mirrors a worker query in src/background.ts; see test/README.md.
 */

import {
  daysBetween,
  groupByPlayer,
  latestWindow,
  nearDates,
  statsFrom,
  summariesFrom,
} from "@/storage/historyQueries";

let failures = 0;
const pending: Promise<void>[] = [];
const check = (name: string, fn: () => void | Promise<void>) => {
  const report = (error?: unknown) => {
    if (error) {
      failures++;
      console.log("FAIL", name, "-", (error as Error).message);
    } else {
      console.log("PASS", name);
    }
  };
  try {
    const result = fn();
    if (result instanceof Promise) pending.push(result.then(() => report(), report));
    else report();
  } catch (error) {
    report(error);
  }
};
const eq = (a: unknown, b: unknown, m = "") => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
};

const entry = (playerId: string, date: string, overallRating = 100) => ({
  id: `${playerId}:${date}`,
  playerId,
  date,
  capturedAt: "t",
  overallRating,
});

// Out of order on purpose: the store hands them back by key, a report may not.
const store = [
  entry("2", "2026-03-10"),
  entry("1", "2026-01-05"),
  entry("1", "2026-01-01"),
  entry("1", "2026-01-02"),
  entry("2", "2026-01-01"),
  entry("1", "2026-03-01"),
];
const byPlayer = groupByPlayer(store);

check("grouped by player, each in date order", () => {
  eq([...byPlayer.keys()], ["2", "1"]);
  eq(byPlayer.get("1")!.map((e) => e.date), ["2026-01-01", "2026-01-02", "2026-01-05", "2026-03-01"]);
  eq(daysBetween("2026-03-28", "2026-03-30"), 2, "across the March DST change");
});

check("summaries: days, range and the gaps in between, as the worker's", () => {
  const summaries = summariesFrom(byPlayer);
  eq(summaries.get("1"), {
    playerId: "1",
    days: 4,
    firstDate: "2026-01-01",
    lastDate: "2026-03-01",
    missingDays: 56, // Jan 1 to Mar 1 is 60 days counting both ends, 4 of them held
  });
  eq(summaries.get("2")!.missingDays, 67, "Jan 1 to Mar 10 is 69 days, 2 held");
  eq(summariesFrom(new Map()).size, 0, "empty store");
});

check("stats: records, players and JSON bytes", async () => {
  const stats = await statsFrom(store);
  eq(stats.records, 6);
  eq(stats.players, 2);
  eq(stats.jsonBytes, store.reduce((sum, e) => sum + JSON.stringify(e).length, 0));
  eq((await statsFrom([])).records, 0, "empty store");
});

check("latest window: anchored on each player's own last day", () => {
  const windows = latestWindow(byPlayer, 30);
  eq(windows.get("1")!.map((e) => e.date), ["2026-03-01"], "Jan days are 55+ days before Mar 1");
  eq(windows.get("2")!.map((e) => e.date), ["2026-03-10"]);
  eq(latestWindow(byPlayer, 60).get("1")!.map((e) => e.date), [
    "2026-01-01",
    "2026-01-02",
    "2026-01-05",
    "2026-03-01",
  ], "Jan 1 is exactly 59 days back");
});

check("near dates: within the tolerance either side; players with nothing in range left out", () => {
  const near = nearDates(
    byPlayer,
    [
      { playerId: "1", date: "2026-01-03" },
      { playerId: "2", date: "2026-02-10" },
      { playerId: "9", date: "2026-01-01" },
    ],
    2
  );
  eq(near.get("1")!.map((e) => e.date), ["2026-01-01", "2026-01-02", "2026-01-05"]);
  eq(near.has("2"), false, "nothing within 2 days of Feb 10");
  eq(near.has("9"), false, "unknown player");
});

Promise.all(pending).then(() => {
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
});
