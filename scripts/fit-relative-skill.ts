/**
 * Fits the global relative-skill line (the 100% behind "Relative skill") of
 * every sport from a backup file, and with --write overwrites
 * src/sports/<sport>/relativeSkillReference.ts. Run it after more teams have
 * been scouted. The league line is not written: the extension fits it at
 * runtime from the viewer's own league (src/base/scout/leagueRelativeSkill.ts);
 * --compare shows it for the backup's league too.
 *
 * The fitting itself is src/base/relativeSkillFit.ts, shared with the
 * extension. Build and run this like the checks in test/README.md (an SSR
 * bundle via a throwaway vite config, input this file):
 *
 *   node fit.mjs path/to/ppm-assistant-backup.json [--sport hockey|soccer|basketball]
 *     [--percentile 0.95] [--exp-at-28 200] [--exp-ramp-until 20] [--exp-late-rate 0.85]
 *     [--compare] [--write]
 *
 * XP is not fitted: the `exp` column is xpCurve() in src/base/relativeSkillFit.ts,
 * set by these parameters. Fixed, not a parameter: XP is exactly 0 at 15, when
 * a player arrives from the youth facilities or the draft.
 *   --exp-at-28      XP of a top player at 28. Per sport by default (the
 *                    user's figures, `expAt28` below): hockey 200, soccer 200,
 *                    basketball 150. The flag overrides it for every sport
 *                    run, so pair it with --sport.
 *   --exp-ramp-until the per-season gain rises from 0 at 15 to its full rate at
 *                    this age, then stays at it to 28 (every sport: 20)
 *   --exp-late-rate  the per-season gain after 28, as a share of the full rate
 *                    (every sport: 0.85)
 * The median XP of the players with full skills is printed (medXP) as a
 * diagnostic only.
 */

import fs from "fs";
import path from "path";
import { calculateSkillWithExp } from "@/base/calculations";
import {
  DEFAULT_XP_CURVE,
  RELATIVE_SKILL_PERCENTILE,
  RelativeSkillFit,
  SkillPair,
  agesBetween,
  fitGlobalOr,
  fitLeagueOr,
  fitShareAndExp,
  referenceTable,
  isLeagueSnapshot,
  scoutPoints,
  xpCurve,
} from "@/base/relativeSkillFit";
import { calculateProjectedMaxSkillForAge } from "@/classes/playerCalculations";
import {
  bestPositionRating as hockeyBest,
  overallFromSkills as hockeyOverall,
} from "@/sports/hockey/growthPace";
import {
  bestPositionRating as soccerBest,
  overallFromSkills as soccerOverall,
} from "@/sports/soccer/growthPace";
import { basketballOverall, bestBasketballPosition } from "@/sports/basketball/growthModel";
import { BasketballSkills } from "@/sports/basketball/classes/BasketballPlayer";
import { relativeSkillFit as hockeyCurrent } from "@/sports/hockey/relativeSkillReference";
import { relativeSkillFit as soccerCurrent } from "@/sports/soccer/relativeSkillReference";
import { relativeSkillFit as basketballCurrent } from "@/sports/basketball/relativeSkillReference";
import { BackupFile } from "@/types/Backup";
import { GrowthPrediction } from "@/types/GrowthData";
import { StoredPlayerData } from "@/types/StoredPlayer";
import { Sport } from "@/types/Sport";

type AnySkills = Record<string, number>;

type SportConfig = {
  /** Best position's rating without XP, and OR, from one day's skills. */
  rate: (skills: AnySkills, height: number | undefined) => { rating: number; overall: number };
  current: RelativeSkillFit;
  /** XP of a top player at 28, the XP curve's anchor (--exp-at-28 overrides). */
  expAt28: number;
  daysPerSeason: number;
  minAge: number;
  maxAge: number;
};

const SPORTS: Record<Sport, SportConfig> = {
  hockey: {
    rate: (skills) => ({
      rating: hockeyBest(skills as never).rating,
      overall: hockeyOverall(skills as never),
    }),
    current: hockeyCurrent,
    expAt28: 200,
    daysPerSeason: 112,
    minAge: 15,
    maxAge: 45,
  },
  soccer: {
    rate: (skills) => ({
      rating: soccerBest(skills as never).rating,
      overall: soccerOverall(skills as never),
    }),
    current: soccerCurrent,
    expAt28: 200,
    daysPerSeason: 112,
    minAge: 15,
    maxAge: 40,
  },
  basketball: {
    rate: (skills, height) => ({
      rating: bestBasketballPosition(skills as BasketballSkills, height ?? 0).rating,
      overall: basketballOverall(skills as BasketballSkills),
    }),
    current: basketballCurrent,
    expAt28: 150,
    daysPerSeason: 70,
    minAge: 15,
    maxAge: 40,
  },
};

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const backupPath = args.find(
  (arg, i) => !arg.startsWith("--") && !(args[i - 1] ?? "").match(/^--(sport|percentile|exp-at-28|exp-ramp-until|exp-late-rate)$/)
);
if (!backupPath) {
  throw new Error(
    "Usage: fit-relative-skill <backup.json> [--sport s] [--percentile p] [--compare] [--write]"
  );
}
const percentile = Number(option("percentile", String(RELATIVE_SKILL_PERCENTILE)));
const onlySport = option("sport", "");
const expAt28Flag = option("exp-at-28", "");
const xpOptions = {
  ...DEFAULT_XP_CURVE,
  rampUntil: Number(option("exp-ramp-until", String(DEFAULT_XP_CURVE.rampUntil))),
  lateRate: Number(option("exp-late-rate", String(DEFAULT_XP_CURVE.lateRate))),
};
const compare = args.includes("--compare");
const write = args.includes("--write");

const backup = JSON.parse(fs.readFileSync(backupPath, "utf8")) as BackupFile;

type CachedPlayer = { player: StoredPlayerData; ownTeam: boolean; seasonDay: number };

/** Every cache of a sport merged, one record per player: the most recently updated. */
function playersOf(sport: Sport): Map<string, CachedPlayer> {
  const players = new Map<string, CachedPlayer>();
  for (const [key, cache] of Object.entries(backup.playerCaches)) {
    if (!key.includes(`:${sport}:`)) continue;
    for (const [id, player] of Object.entries(cache.players)) {
      const seen = players.get(id);
      const updated = player.metadata?.updatedAt ?? "";
      if (seen && (seen.player.metadata?.updatedAt ?? "") >= updated) continue;
      players.set(id, {
        player,
        ownTeam: player.baseInfo.teamId === cache.teamId,
        seasonDay: cache.currentSeasonDay ?? 0,
      });
    }
  }
  return players;
}

function fitSport(sport: Sport) {
  const config = SPORTS[sport];
  const ages = agesBetween(config.minAge, config.maxAge);
  const snapshots = backup.scoutSnapshots?.[sport] ?? [];
  const leagueTeams = new Set(backup.leagues?.[sport]?.teamIds ?? []);

  // 1. Global OR reference.
  const points = scoutPoints(snapshots, config.daysPerSeason);
  const global = fitGlobalOr(points, ages, percentile);

  // 2. OR to rating: players with full skills and XP, from every cache of the sport.
  const players = playersOf(sport);
  const pairs: (SkillPair & { id: string })[] = [];
  const seenPair = new Set<string>();
  const addPair = (id: string, x: number, skills: AnySkills, height: number | undefined, exp: number) => {
    const key = `${id}:${Math.round(x)}`;
    if (seenPair.has(key)) return;
    const { rating, overall } = config.rate(skills, height);
    if (overall <= 0 || rating <= 0) return;
    seenPair.add(key);
    pairs.push({ x, share: rating / overall, exp, id });
  };
  for (const [id, { player }] of players) {
    if (!player.skills || player.experience == null) continue;
    const seasonDay = player.metadata?.seasonDay ?? 0;
    const height = (player.baseInfo as { height?: number }).height;
    addPair(id, player.baseInfo.age + seasonDay / config.daysPerSeason, player.skills as AnySkills, height, player.experience);
  }
  // History days with XP add the same players at earlier ages (newest first,
  // so the cache's own point keeps its age). A player's stored age is from
  // his last update, so ages count back from that.
  const ageOn = (id: string, date: string): number | null => {
    const cached = players.get(id);
    if (!cached) return null;
    const { player } = cached;
    const updated = Date.parse(player.metadata?.updatedAt ?? backup.exportedAt);
    const daysBefore = (updated - Date.parse(`${date}T12:00:00Z`)) / 86_400_000;
    return player.baseInfo.age + ((player.metadata?.seasonDay ?? 0) - daysBefore) / config.daysPerSeason;
  };
  const history = (sport === "hockey" ? backup.skillHistory : backup.sportSkillHistory?.[sport]) ?? [];
  [...history]
    .filter((entry) => entry.skills && entry.experience != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((entry) => {
      const age = ageOn(entry.playerId, entry.date);
      const height = (entry as { height?: number }).height;
      if (age != null) addPair(entry.playerId, age, entry.skills as AnySkills, height, entry.experience!);
    });
  const shareExp = fitShareAndExp(pairs, ages);
  const exp = xpCurve(ages, {
    ...xpOptions,
    expAtAnchor: expAt28Flag ? Number(expAt28Flag) : config.expAt28,
  });

  const fit: RelativeSkillFit = {
    percentile,
    rows: ages.map((age, i) => ({
      age,
      or: Math.round(global.curve[i]),
      share: Number(shareExp.share[i].toFixed(4)),
      exp: Math.round(exp[i]),
    })),
  };

  // 3. The backup's own league, as the extension would fit it.
  // Only the list's season, as the extension does (isLeagueSnapshot).
  const leagueList = backup.leagues?.[sport];
  const leaguePoints = leagueList
    ? scoutPoints(snapshots, config.daysPerSeason, (row) => isLeagueSnapshot(row, leagueList, leagueTeams))
    : [];
  const league = fitLeagueOr(leaguePoints, ages, percentile, fit.rows.map((row) => row.or));

  return { config, ages, points, leaguePoints, global, league, pairs, shareExp, fit, players };
}

function checkFinite(sport: Sport, fit: RelativeSkillFit) {
  const bad = fit.rows.filter(
    (row) =>
      ![row.or, row.share, row.exp].every(Number.isFinite) || row.or <= 0 || row.share <= 0 || row.exp < 0
  );
  if (bad.length > 0) {
    throw new Error(`${sport}: refusing to write, bad rows at ages ${bad.map((row) => row.age).join(", ")}`);
  }
}

function fitSource(sport: Sport, fit: RelativeSkillFit): string {
  const rows = fit.rows
    .map((row) => `    { age: ${row.age}, or: ${row.or}, share: ${row.share}, exp: ${row.exp} },`)
    .join("\n");
  return `import { RelativeSkillFit, orReferenceTable, referenceTable } from "@/base/relativeSkillFit";

/**
 * ${sport[0].toUpperCase()}${sport.slice(1)}'s global relative-skill line: per age, the ${Math.round(fit.percentile * 100)}th
 * percentile of scouted OR (\`or\`), the best position's rating as a share of
 * OR (\`share\`) and XP (\`exp\`). 100% = share x or with that XP.
 *
 * Generated by scripts/fit-relative-skill.ts from the ${backup.exportedAt.slice(0, 10)} backup.
 * Do not edit by hand: rerun the script with --write on a newer backup.
 */
export const relativeSkillFit: RelativeSkillFit = {
  percentile: ${fit.percentile},
  rows: [
${rows}
  ],
};

/** The global 100% line as a table: rating without XP (\`skill\`) and XP per age. */
export const relativeSkillReference = referenceTable(relativeSkillFit);

/** The top-5% OR line (the \`or\` column): what the profile charts' OR view draws and its pace reads. */
export const relativeOrReference = orReferenceTable(relativeSkillFit);
`;
}

const fmt = (value: number | null | undefined, width: number) =>
  String(value == null || Number.isNaN(value) ? "-" : Math.round(value)).padStart(width);

/** The 100% value at an exact age, as BasePlayer reads a table. */
const maxAt = (table: GrowthPrediction, age: number, seasonDay: number, daysPerSeason: number) =>
  calculateProjectedMaxSkillForAge(age, seasonDay, daysPerSeason, table);

for (const sport of (onlySport ? [onlySport] : Object.keys(SPORTS)) as Sport[]) {
  const result = fitSport(sport);
  const { config, ages, fit, global, league, shareExp } = result;
  const table = referenceTable(fit);
  const leagueTable = league ? referenceTable(fit, league.curve) : null;
  console.log(
    `\n=== ${sport}: OR p${Math.round(percentile * 100)}, ${result.points.length} scouted player-seasons ` +
      `(${result.leaguePoints.length} in the backup's league); ${result.pairs.length} skill+XP points ` +
      `from ${new Set(result.pairs.map((q) => q.id)).size} players`
  );
  console.log("age |  n  win  raw    OR | lgN lgRaw ratio lgOR | prs share medXP  exp | global ratingXp  league ratingXp | current");
  ages.forEach((age, i) => {
    const g = global.measured[i];
    const l = league?.measured[i];
    const current = referenceTable(config.current).find((row) => row.age === age);
    console.log(
      `${age} | ${fmt(g?.n, 4)} ${g ? `±${g.half}`.padEnd(5) : "  -  "}${fmt(g?.value, 5)} ${fmt(global.curve[i], 5)} | ` +
        `${fmt(l?.n, 3)} ${fmt(l?.value, 5)} ${(league?.ratios[i] ?? NaN).toFixed(2).padStart(5)} ${fmt(league?.curve[i], 5)} | ` +
        `${fmt(shareExp.shareMeasured[i]?.n, 3)} ${shareExp.share[i].toFixed(3)} ${fmt(shareExp.exp[i], 5)} ${fmt(fit.rows[i].exp, 4)} | ` +
        `${fmt(calculateSkillWithExp(table[i].skill, table[i].exp), 15)} ` +
        `${fmt(leagueTable ? calculateSkillWithExp(leagueTable[i].skill, leagueTable[i].exp) : null, 16)} | ` +
        `${fmt(current ? calculateSkillWithExp(current.skill, current.exp) : null, 7)}`
    );
  });
  if (!league) console.log("No league line: the backup's league has too few scouted players.");

  if (write) {
    checkFinite(sport, fit);
    const file = path.resolve("src/sports", sport, "relativeSkillReference.ts");
    fs.writeFileSync(file, fitSource(sport, fit));
    console.log(`\nWrote ${file}`);
  }

  if (compare) {
    const currentTable = referenceTable(config.current);
    const currentLeague = fitLeagueOr(result.leaguePoints, ages, config.current.percentile, config.current.rows.map((r) => r.or));
    const currentLeagueTable = currentLeague ? referenceTable(config.current, currentLeague.curve) : null;
    const percent = (value: number, max: number | null) =>
      (max ? `${Math.round((value / max) * 100)}%` : "-").padStart(4);
    console.log("\nOwn players: current global / league -> new global / league");
    [...result.players.values()]
      .filter(({ player, ownTeam }) => ownTeam && player.skills && player.experience != null)
      .sort((a, b) => a.player.baseInfo.age - b.player.baseInfo.age)
      .forEach(({ player, seasonDay }) => {
        const height = (player.baseInfo as { height?: number }).height;
        const ratingXp = calculateSkillWithExp(config.rate(player.skills as AnySkills, height).rating, player.experience!);
        const age = player.baseInfo.age;
        const at = (t: GrowthPrediction | null) => (t ? maxAt(t, age, seasonDay, config.daysPerSeason) : null);
        console.log(
          `${player.baseInfo.name.padEnd(24)} ${String(age).padStart(2)} OR ${fmt(player.baseInfo.overallRating, 4)} ` +
            `ratingXp ${fmt(ratingXp, 4)}  ` +
            `${percent(ratingXp, at(currentTable))} / ${percent(ratingXp, at(currentLeagueTable))} -> ` +
            `${percent(ratingXp, at(table))} / ${percent(ratingXp, at(leagueTable))}`
        );
      });
  }
}
