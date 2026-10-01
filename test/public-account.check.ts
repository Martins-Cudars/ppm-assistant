/**
 * Assertions for src/storage/publicAccount.ts - see test/README.md.
 *
 * The case that matters: the logged-out "Public account" demo team's cache
 * (basketball team-3323) sorts before the user's (team-39743), and the report
 * used to take the first key - showing 15 demo players instead of the user's.
 */

import {
  isPublicAccountLink,
  pickTeamCacheKey,
  publicAccountCacheKeys,
} from "@/storage/publicAccount";

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
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
};

const cache = (teamName: string, squadAt: string | null, lastModified = "2026-10-01T07:00:00Z") => ({
  teamId: "x",
  lastModified,
  squad: squadAt ? { playerIds: ["1"], updatedAt: squadAt } : undefined,
  players: { "1": { baseInfo: { teamName } } },
});

check("link: the public account's slug, name or known id", () => {
  eq(isPublicAccountLink("/en/team.html?data=3323-public-account", "Public account", "basketball"), true, "slug");
  eq(isPublicAccountLink("/lv/komanda.html?data=3323-x", "Publiskais konts", "basketball"), true, "known id");
  eq(isPublicAccountLink("/en/team.html?data=9999", "Public Account", "hockey"), true, "name");
  eq(isPublicAccountLink("/en/team.html?data=39743-skanste-sentinels", "Skanste Sentinels", "basketball"), false, "own team");
  // 3323 is basketball's public id, not hockey's.
  eq(isPublicAccountLink("/en/team.html?data=3323-real-team", "Real Team", "hockey"), false, "other sport's id");
});

check("report picks the user's cache even when the public one sorts first", () => {
  const storage = {
    "ppm-assistant:basketball:team-3323": cache("Public account", "2026-10-01T07:43:24Z"),
    "ppm-assistant:basketball:team-39743": cache("Skanste Sentinels", "2026-10-01T07:00:00Z"),
  };
  eq(pickTeamCacheKey(storage, "basketball"), "ppm-assistant:basketball:team-39743");
});

check("a public team with an unlisted id is recognised by its players' team name", () => {
  const storage = {
    "ppm-assistant:hockey:team-1111": cache("Public Account", "2026-10-01T09:00:00Z"),
    "ppm-assistant:hockey:team-129853": cache("Preczol HC", "2026-10-01T07:00:00Z"),
  };
  eq(pickTeamCacheKey(storage, "hockey"), "ppm-assistant:hockey:team-129853");
  eq(publicAccountCacheKeys(storage, "hockey"), ["ppm-assistant:hockey:team-1111"]);
});

check("two real teams: the newest squad overview wins; unknown and other sports are ignored", () => {
  const storage = {
    "ppm-assistant:hockey:team-100": cache("A", "2026-09-01T00:00:00Z"),
    "ppm-assistant:hockey:team-200": cache("B", null, "2026-09-20T00:00:00Z"),
    "ppm-assistant:hockey:team-unknown": cache("C", "2026-10-01T00:00:00Z"),
    "ppm-assistant:basketball:team-300": cache("D", "2026-10-01T00:00:00Z"),
  };
  eq(pickTeamCacheKey(storage, "hockey"), "ppm-assistant:hockey:team-200");
  eq(pickTeamCacheKey({}, "hockey"), null, "none");
});

check("cleanup finds exactly the public caches, per sport", () => {
  const storage = {
    "ppm-assistant:basketball:team-3323": cache("Public account", null),
    "ppm-assistant:basketball:team-39743": cache("Skanste Sentinels", null),
    "ppm-assistant:hockey:team-5289": cache("Public Account", null),
    "ppm-assistant:hockey:team-129853": cache("Preczol HC", null),
    "ppm-assistant:settings": { lang: "en" },
  };
  eq(publicAccountCacheKeys(storage, "basketball"), ["ppm-assistant:basketball:team-3323"]);
  eq(publicAccountCacheKeys(storage, "hockey"), ["ppm-assistant:hockey:team-5289"]);
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
