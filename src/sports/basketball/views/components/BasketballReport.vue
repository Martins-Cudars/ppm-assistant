<script setup lang="ts">
/**
 * The basketball Player Report: every cached basketball player in one grouped,
 * heatmapped table. Same look as hockey's (shared SortableTable, heatmap and
 * reportTable.css), basketball's own columns.
 *
 * Growth columns (Pace, Skill/OR @25, Potential) measure each player against
 * an adaptive reference: the best squad player at each age = 100%, rebuilt
 * from the stored history on every load - see growthModel.ts.
 * Backup and Clear live on the Hockey tab - they already cover every sport.
 */
import { computed, onMounted, ref, watch } from "vue";
import { BasketballPlayer, BasketballSkills } from "@/sports/basketball/classes/BasketballPlayer";
import {
  StoredBasketballPlayer,
  deserializeBasketballPlayer,
  normalizePlayerId,
} from "@/sports/basketball/capture";
import { ratingSettings } from "@/sports/basketball/settings";
import { basketballPlayerProfile } from "@/sports/basketball/playerProfile";
import routes from "@/sports/basketball/routes";
import { getLocalizedPageForLang } from "@/sports/routeDispatch";
import { readSportTeamCache } from "@/storage/playerCache";
import {
  exportSkillHistory,
  getSkillHistoryStats,
  getSkillHistorySummaries,
} from "@/storage/skillHistoryDb";
import {
  BasketballPace,
  BasketballPotential,
  CAMP_UNTIL_AGE,
  HEIGHT_STOP_AGE,
  PACE_MIN_SPAN_DAYS,
  PACE_PROVISIONAL_MIN_DAYS,
  PACE_WINDOW_DAYS,
  POTENTIAL_AGE,
  ReferenceCurve,
  ReferencePoint,
  basketballDateAtAge,
  basketballEntryNear,
  basketballOverall,
  bestBasketballPosition,
  buildReferenceCurve,
  entryAge,
  measureBasketballPace,
  projectBasketball,
  projectBasketballPotential,
} from "@/sports/basketball/growthModel";
import { getUserSettings } from "@/storage/userSettings";
import { SkillHistoryEntry, SkillHistoryStats, SkillHistorySummary } from "@/types/SkillHistory";
import { buildPlayerProfileUrl } from "@/utils/parsers";
import SortableTable, { type Column } from "@/components/SortableTable.vue";
import RatingStars from "@/components/RatingStars.vue";
import GrowthComparisonChart, {
  type GrowthReference,
  type GrowthSeries,
} from "@/components/GrowthComparisonChart.vue";
import { useCompareWith } from "@/base/scout/useCompareWith";
import { squadHistoryOnly } from "@/base/scout/scoutReference";
import { exportScoutSnapshots, readLeagueTeams } from "@/storage/scoutSnapshotDb";
import { LeagueTeams, ScoutSnapshot } from "@/types/ScoutSnapshot";
import { buildSquadBestCurve, entryOverall, historyPoints } from "@/sports/basketball/historyChart";
import { GROWTH_RAMP, SKILL_RAMP, heatStyle } from "@/components/heatmap";
import "@/components/reportTable.css";

const loading = ref(true);
const players = ref<BasketballPlayer[]>([]);
const teamId = ref("unknown");
const squad = ref<{ playerIds: string[]; updatedAt: string } | null>(null);
const summaries = ref<Map<string, SkillHistorySummary>>(new Map());
const historyStats = ref<SkillHistoryStats | null>(null);
const lang = ref("en");
const seasonDay = ref(1);
// Every stored basketball day, grouped by player: the reference curve needs
// the whole squad's past, not just recent weeks. Null when the read failed,
// so growth cells show "-" with a reason rather than "no history".
const history = ref<Map<string, SkillHistoryEntry<BasketballSkills>[]> | null>(new Map());
// Other teams' rosters and the user's league, for the chart's League / Elite lines.
const scoutSnapshots = ref<ScoutSnapshot[]>([]);
const league = ref<LeagueTeams | null>(null);

onMounted(async () => {
  const [cache, historySummaries, stats, settings, allHistory, scouted, leagueTeams] =
    await Promise.all([
      readSportTeamCache<StoredBasketballPlayer>("basketball"),
      getSkillHistorySummaries("basketball"),
      getSkillHistoryStats("basketball"),
      getUserSettings(),
      exportSkillHistory("basketball"),
      exportScoutSnapshots("basketball"),
      readLeagueTeams("basketball"),
    ]);
  // A failed read just leaves the scouted lines empty; nothing else depends on them.
  scoutSnapshots.value = scouted ?? [];
  league.value = leagueTeams;
  if (cache) {
    players.value = Object.values(cache.players).map(deserializeBasketballPlayer);
    teamId.value = cache.teamId;
    squad.value = cache.squad ?? null;
    seasonDay.value = cache.currentSeasonDay || 1;
  }
  summaries.value = historySummaries;
  historyStats.value = stats;
  lang.value = settings.lang;
  if (allHistory === null) {
    history.value = null;
  } else {
    const grouped = new Map<string, SkillHistoryEntry<BasketballSkills>[]>();
    (allHistory as unknown as SkillHistoryEntry<BasketballSkills>[]).forEach((entry) => {
      const list = grouped.get(entry.playerId);
      if (list) list.push(entry);
      else grouped.set(entry.playerId, [entry]);
    });
    history.value = grouped;
  }
  loading.value = false;
});

const idOf = (player: BasketballPlayer) => normalizePlayerId(player.id) ?? player.id;
const exactAgeOf = (player: BasketballPlayer) =>
  player.age + seasonDay.value / basketballPlayerProfile.daysPerSeason;

// --- Growth ----------------------------------------------------------------------
// All computed once per load, not per cell: the columns and their sorts share them.

/** The age the @25 columns report: projected for younger players, recorded for older. */
const PROJECTION_AGE = 25;
/** How far from the computed "turned 25" date a recorded day may be. */
const AT_AGE_TOLERANCE_DAYS = 14;

const nameById = computed(() => new Map(players.value.map((p) => [idOf(p), p.name])));

const curve = computed<ReferenceCurve>(() =>
  buildReferenceCurve(
    history.value ?? new Map(),
    new Map(players.value.map((p) => [idOf(p), exactAgeOf(p)]))
  )
);

const measuredCurve = computed(() => curve.value.filter((p) => p.source === "squad"));

// --- Growth comparison chart ------------------------------------------------------

const activeTab = ref<"table" | "graph">("table");

// Every filtered player's history on one chart. A player with no stored days
// still shows as a dot at today's value.
const comparisonSeries = computed<GrowthSeries[]>(() =>
  filtered.value.map((player) => {
    const entries = history.value?.get(idOf(player)) ?? [];
    const exactAge = exactAgeOf(player);
    const skill = historyPoints(entries, exactAge, "skill", player.height);
    const or = historyPoints(entries, exactAge, "or", player.height);
    return {
      id: idOf(player),
      label: player.name,
      skill: skill.length > 0 ? skill : [{ x: exactAge, y: player.getBestPosition().ratingWithBonus }],
      or: or.length > 0 ? or : [{ x: exactAge, y: player.overallRating }],
    };
  })
);

// The grey line: the best any squad player had on reaching each age.
const squadBestReference = computed<GrowthReference>(() => {
  const best = buildSquadBestCurve(
    // Opponents opened on their profile are in the history too - not "your squad".
    squadHistoryOnly(history.value ?? new Map()),
    new Map(players.value.map((p) => [idOf(p), exactAgeOf(p)])),
    new Map(players.value.map((p) => [idOf(p), p.height]))
  );
  return { label: "Your squad's best at each age", ...best };
});

// --- Compare with: Squad / League / Elite ------------------------------------------
// Shared with the other sports' reports - see src/base/scout/useCompareWith.ts.
// Under Squad (and until a group has enough revisits) Pace is basketball's own.

const {
  COMPARE_OPTIONS,
  compareWith,
  chartReferenceKey,
  compareCaption,
  referenceOptions,
  scoutedCoverage,
  orVsBestFor,
  orVsBestTitle,
  shownPaceFor,
  shownPaceMissingTitle,
  paceHeader,
} = useCompareWith<BasketballPlayer>({
  sport: "basketball",
  daysPerSeason: basketballPlayerProfile.daysPerSeason,
  players: () => players.value,
  snapshots: () => scoutSnapshots.value,
  league: () => league.value,
  ownTeamId: () => teamId.value,
  squadReference: () => squadBestReference.value,
  squadChartCaption: "The best any of your own players had on reaching each age",
  squadCaption:
    "Squad: the best any of your own players had on reaching each age. Pace: against your best player's training at each age.",
  idOf,
  exactAgeOf,
  overallOf: (player) => player.overallRating,
  squadPace: (player) => {
    const pace = paceFor(player);
    return pace?.pace != null
      ? { pace: pace.pace, provisional: pace.provisional, title: paceTitle(player) }
      : null;
  },
  squadPaceMissingTitle: (player) => paceTitle(player),
  ownOrDays: (player) =>
    (history.value?.get(idOf(player)) ?? []).flatMap((entry) => {
      const or = entryOverall(entry);
      return or !== null ? [{ date: entry.date, or }] : [];
    }),
  ageOnDate: (player, date) => entryAge(date, exactAgeOf(player)),
  rateShape: (age) => curve.value.find((point) => point.age === age)?.perDay ?? 0,
});

const referenceTitle = (point: ReferencePoint) =>
  point.source === "squad"
    ? `${nameById.value.get(point.bestPlayerId ?? "") ?? "a former player"}: ` +
      `${point.bestPerDay?.toFixed(2)}/day; ${point.players} player(s) measured at ${point.age}`
    : "No squad data at this age yet - default curve";

const paceByPlayer = computed(() => {
  const paces = new Map<string, BasketballPace | null>();
  players.value.forEach((player) => {
    const entries = history.value?.get(idOf(player));
    paces.set(
      idOf(player),
      entries ? measureBasketballPace(entries, exactAgeOf(player), curve.value) : null
    );
  });
  return paces;
});
const paceFor = (player: BasketballPlayer) => paceByPlayer.value.get(idOf(player)) ?? null;

const round2 = (value: number) => Math.round(value * 100) / 100;

const paceTitle = (player: BasketballPlayer) => {
  const pace = paceFor(player);
  if (!pace) {
    if (history.value === null) return "History could not be loaded";
    const stored = summaries.value.get(idOf(player))?.days ?? 0;
    return (
      `Needs ${PACE_PROVISIONAL_MIN_DAYS} days of training within the last ${PACE_WINDOW_DAYS} ` +
      `days of history (${stored} day${stored === 1 ? "" : "s"} stored)`
    );
  }
  if (pace.pace === null) return "Past the reference curve's last age - no pace to compare";
  const age = Math.floor(pace.midAge);
  const point = curve.value.find((p) => p.age === age);
  const smoothed =
    point?.bestPerDay !== undefined && Math.abs(point.bestPerDay - point.perDay) > 0.005
      ? ` (${round2(point.bestPerDay)}, smoothed)`
      : "";
  const lines = [
    `${round2(pace.pointsPerDay)} skill points per training day (${Math.round(pace.pointsPerSeason)}/season)`,
    `100% at ${age} = ${round2(pace.referencePerDay ?? 0)}/day - ` +
      (point?.source === "squad"
        ? `your best at ${age}: ${nameById.value.get(point.bestPlayerId ?? "") ?? "a former player"}${smoothed}`
        : "no squad data at this age yet, default curve"),
    `(${pace.measuredDays} days measured, ${pace.fromDate} to ${pace.toDate})`,
  ];
  const skipped = [
    pace.skippedNoTrainingDays > 0 ? `${pace.skippedNoTrainingDays} no-training days` : "",
    pace.skippedCampDays > 0 ? `${pace.skippedCampDays} training-camp days` : "",
  ].filter(Boolean);
  if (skipped.length > 0) lines.push(`Skipped ${skipped.join(" and ")}`);
  lines.push(
    pace.campDaysAssumed
      ? "Camp days last season: unknown (less than a season of history)"
      : `Camp days last season: ${pace.campDaysPerSeason}`
  );
  if (pace.heightPerSeason > 0) lines.push(`Growing ~${pace.heightPerSeason.toFixed(1)} cm/season`);
  if (pace.provisional) {
    lines.unshift(`Provisional: only ${pace.measuredDays} days of data - settles at ${PACE_MIN_SPAN_DAYS}`);
  }
  return lines.join("\n");
};

/**
 * Skill and OR at PROJECTION_AGE: recorded from history for players past it,
 * projected for younger ones. One shape for both, so a 19-year-old's
 * projection sorts against what a 27-year-old actually reached.
 */
type AtAgeValue = {
  skill: number | null;
  or: number | null;
  kind: "recorded" | "projected";
  title: string;
};

const atAgeValues = (targetAge: number) => {
  const values = new Map<string, AtAgeValue | null>();
  players.value.forEach((player) => {
    const id = idOf(player);
    const exactAge = exactAgeOf(player);

    if (exactAge >= targetAge) {
      const target = basketballDateAtAge(exactAge, targetAge);
      const entry = basketballEntryNear(history.value?.get(id) ?? [], target, AT_AGE_TOLERANCE_DAYS);
      if (!entry) {
        values.set(id, null);
        return;
      }
      const height = entry.height ?? player.height;
      const best = bestBasketballPosition(entry.skills, height);
      values.set(id, {
        skill: best.rating,
        or: entry.overallRating ?? basketballOverall(entry.skills),
        kind: "recorded",
        title:
          `Recorded ${entry.date}, when the player was about ${targetAge} ` +
          `(best position ${best.name} at ${height} cm, no XP)`,
      });
      return;
    }

    const pace = paceFor(player);
    const projection = projectBasketball(
      player.skills,
      player.height,
      exactAge,
      pace,
      curve.value,
      targetAge
    );
    if (!pace || pace.pace === null || !projection) {
      values.set(id, null);
      return;
    }
    const growing =
      projection.height > player.height
        ? `Height grows ${player.height} → ${projection.height} cm (current rate until ${HEIGHT_STOP_AGE}). `
        : "";
    const camps =
      exactAge < CAMP_UNTIL_AGE && pace.campDaysPerSeason > 0
        ? `Includes ${pace.campDaysPerSeason} camp days a season until ${CAMP_UNTIL_AGE}` +
          (pace.campDaysAssumed ? " (assumed: less than a season of history). " : " (from last season). ")
        : "";
    values.set(id, {
      skill: projection.rating,
      or: projection.overall,
      kind: "projected",
      title:
        `Projected: ${projection.position} rating (no XP) at ${targetAge}, training at ` +
        `${Math.round(pace.pace * 100)}% of your best player's pace at each age from here on ` +
        `(+${Math.round(projection.points)} skill points). Shooting and blocking keep their ` +
        "current share of training; the rest is spent balanced on the rated skills. " +
        growing +
        camps +
        (pace.provisional ? `Provisional: the pace rests on only ${pace.measuredDays} days of data.` : ""),
    });
  });
  return values;
};
const atAgeByPlayer = computed(() => atAgeValues(PROJECTION_AGE));
// The same at 32: the skill and OR behind Potential's stars (which add XP).
const atAge32ByPlayer = computed(() => atAgeValues(POTENTIAL_AGE));
const atAgeFor = (player: BasketballPlayer) => atAgeByPlayer.value.get(idOf(player)) ?? null;

const atAge32For = (player: BasketballPlayer) => atAge32ByPlayer.value.get(idOf(player)) ?? null;
const atAgeMissingTitle = (player: BasketballPlayer, targetAge = PROJECTION_AGE) => {
  if (history.value === null) return "History could not be loaded";
  if (exactAgeOf(player) >= targetAge) {
    return `No stored day with skills within ${AT_AGE_TOLERANCE_DAYS} days of when the player turned ${targetAge}`;
  }
  return "No pace to project from";
};

const potentialByPlayer = computed(() => {
  const values = new Map<string, BasketballPotential | null>();
  players.value.forEach((player) => {
    const best = player.getBestPosition();
    values.set(
      idOf(player),
      projectBasketballPotential(
        player.skills,
        player.height,
        player.experience,
        exactAgeOf(player),
        paceFor(player),
        curve.value,
        { rating: best.ratingWithBonus, ratingWithXp: best.ratingWithXp, position: best.name }
      )
    );
  });
  return values;
});
const potentialFor = (player: BasketballPlayer) => potentialByPlayer.value.get(idOf(player)) ?? null;

const potentialTitle = (player: BasketballPlayer) => {
  const potential = potentialFor(player);
  if (!potential) return "No pace to project from";
  if (potential.kind === "current") {
    return (
      `${potential.ratingWithXp} now - at or past peak age (${POTENTIAL_AGE}). ` +
      tierLabel(potential.ratingWithXp)
    );
  }
  return (
    `~${potential.ratingWithXp} at ${POTENTIAL_AGE}: ${potential.position} ~${potential.rating} ` +
    `(no XP) + XP ~${Math.round(potential.xp)}. ${tierLabel(potential.ratingWithXp)}. Same model ` +
    `as Skill @${PROJECTION_AGE}, extended; XP grows at the squad's typical rate from here ` +
    "(past playing time elsewhere doesn't carry over)."
  );
};

// --- Filters -------------------------------------------------------------------
// Same team rule as hockey: the squad overview's roster when there is one
// (exact - sold players drop out), else the cache's team id.

const TEAM_FILTER_KEY = "ppm-assistant:report:basketball:team";
const TEAM_OPTIONS = ["My team", "Other teams", "All"] as const;
type TeamOption = (typeof TEAM_OPTIONS)[number];

const readTeamFilter = (): TeamOption => {
  try {
    const saved = localStorage.getItem(TEAM_FILTER_KEY);
    return (TEAM_OPTIONS as readonly string[]).includes(saved ?? "")
      ? (saved as TeamOption)
      : "My team";
  } catch {
    return "My team";
  }
};

const selectedTeam = ref<TeamOption>(readTeamFilter());
watch(selectedTeam, (team) => {
  try {
    localStorage.setItem(TEAM_FILTER_KEY, team);
  } catch {
    // Not remembered this time; the filter still works.
  }
});

const ownSquad = computed(() => (squad.value ? new Set(squad.value.playerIds) : null));
const isMyPlayer = (player: BasketballPlayer) =>
  ownSquad.value ? ownSquad.value.has(idOf(player)) : player.teamId === teamId.value;
const teamKnown = computed(() => squad.value !== null || teamId.value !== "unknown");
const effectiveTeam = computed<TeamOption>(() => (teamKnown.value ? selectedTeam.value : "All"));
const matchesTeam = (player: BasketballPlayer, team: TeamOption) =>
  team === "All" || (team === "My team") === isMyPlayer(player);
const teamCount = (team: TeamOption) => players.value.filter((p) => matchesTeam(p, team)).length;

const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
const selectedPosition = ref("All");

const filtered = computed(() =>
  players.value.filter(
    (player) =>
      matchesTeam(player, effectiveTeam.value) &&
      (selectedPosition.value === "All" || player.getBestPosition().name === selectedPosition.value)
  )
);

// --- Table ---------------------------------------------------------------------

type SkillKey = keyof BasketballSkills;

const positionRating = (player: BasketballPlayer, name: string) =>
  player.getPositions().find((position) => position.name === name)?.ratingWithXp ?? null;

// Skills and position ratings each shade against their own column's max in view.
const columnMax = computed(() => {
  const max = (read: (p: BasketballPlayer) => number | null | undefined) =>
    Math.max(0, ...filtered.value.map((p) => read(p) ?? 0));
  const result: Record<string, number> = {};
  (["shooting", "blocking", "passing", "technical", "speed", "aggression", "jumping"] as SkillKey[]).forEach(
    (key) => (result[key] = max((p) => p.skills?.[key]))
  );
  POSITIONS.forEach((name) => (result[name] = max((p) => positionRating(p, name))));
  return result;
});

// Growth columns shade min..max over the players that have a value.
const growthRange = computed(() => {
  const range = (read: (p: BasketballPlayer) => number | null | undefined) => {
    const values = filtered.value
      .map(read)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    return values.length > 0
      ? { min: Math.min(...values), max: Math.max(...values) }
      : { min: 0, max: 0 };
  };
  return {
    pace: range((p) => shownPaceFor(p)?.pace),
    orVsBest: range((p) => orVsBestFor(p)?.share),
    skill: range((p) => atAgeFor(p)?.skill),
    or: range((p) => atAgeFor(p)?.or),
    skill32: range((p) => atAge32For(p)?.skill),
    or32: range((p) => atAge32For(p)?.or),
  };
});

const skillColumn = (header: string, key: SkillKey): Column => ({
  header,
  key: `skills.${key}`,
  group: "Skills",
  align: "right",
  sortable: true,
  sortValue: (p: BasketballPlayer) => p.skills?.[key] ?? 0,
  cellStyle: (p: BasketballPlayer) => heatStyle(p.skills?.[key], 0, columnMax.value[key], SKILL_RAMP),
});

// All five positions, not just the best: basketball players move between
// positions, and height decides how well each one fits.
const positionColumn = (name: (typeof POSITIONS)[number]): Column => ({
  header: name,
  key: `position-${name}`,
  slot: `position-${name}`,
  group: "All positions",
  align: "right",
  sortable: true,
  sortValue: (p: BasketballPlayer) => positionRating(p, name),
  cellStyle: (p: BasketballPlayer) =>
    heatStyle(positionRating(p, name), 0, columnMax.value[name], SKILL_RAMP),
});

const columns = computed<Column[]>(() => [
  { header: "Name", key: "name", slot: "name", sortable: true, cellClass: "name-cell", group: "Player" },
  { header: "Age", key: "age", sortable: true, group: "Player", align: "right" },
  { header: "CL", key: "careerLongitivity", sortable: true, group: "Player", align: "right" },
  { header: "OR", key: "overallRating", sortable: true, group: "Player", align: "right" },
  { header: "Exp", key: "experience", sortable: true, group: "Player", align: "right" },
  { header: "Height", key: "height", sortable: true, group: "Player", align: "right" },

  skillColumn("Sho", "shooting"),
  skillColumn("Blo", "blocking"),
  skillColumn("Pas", "passing"),
  skillColumn("Tec", "technical"),
  skillColumn("Spd", "speed"),
  skillColumn("Agg", "aggression"),
  skillColumn("Jmp", "jumping"),

  {
    header: "Best Pos",
    key: "position",
    slot: "position",
    sortable: true,
    group: "Position",
    align: "center",
    sortValue: (p: BasketballPlayer) => p.getBestPosition().name,
  },
  {
    header: "Pos Skill",
    key: "skill",
    slot: "skill",
    sortable: true,
    group: "Position",
    align: "right",
    sortValue: (p: BasketballPlayer) => p.getBestPosition().ratingWithXp,
  },
  {
    header: "Skill ★",
    key: "skillStars",
    slot: "skillStars",
    sortable: true,
    group: "Position",
    align: "center",
    sortValue: (p: BasketballPlayer) => p.getBestPosition().ratingWithXp,
  },
  {
    header: "Pos TQ",
    key: "positionTQ",
    slot: "positionTQ",
    sortable: true,
    group: "Position",
    align: "right",
    sortValue: (p: BasketballPlayer) => p.getBestPositionTrainingQuality().totalTrainingQuality,
  },

  {
    header: "OR vs best",
    key: "orVsBest",
    slot: "orVsBest",
    sortable: true,
    group: "Growth",
    align: "right",
    sortValue: (p: BasketballPlayer) => orVsBestFor(p)?.share ?? null,
    cellStyle: (p: BasketballPlayer) =>
      heatStyle(
        orVsBestFor(p)?.share,
        growthRange.value.orVsBest.min,
        growthRange.value.orVsBest.max,
        GROWTH_RAMP
      ),
  },
  {
    header: paceHeader.value,
    key: "pace",
    slot: "pace",
    sortable: true,
    group: "Growth",
    align: "right",
    sortValue: (p: BasketballPlayer) => shownPaceFor(p)?.pace ?? null,
    cellStyle: (p: BasketballPlayer) =>
      heatStyle(shownPaceFor(p)?.pace, growthRange.value.pace.min, growthRange.value.pace.max, GROWTH_RAMP),
  },
  {
    header: `Skill @${PROJECTION_AGE}`,
    key: "skillAtAge",
    slot: "skillAtAge",
    sortable: true,
    group: "Growth",
    align: "right",
    sortValue: (p: BasketballPlayer) => atAgeFor(p)?.skill ?? null,
    cellStyle: (p: BasketballPlayer) =>
      heatStyle(atAgeFor(p)?.skill, growthRange.value.skill.min, growthRange.value.skill.max, GROWTH_RAMP),
  },
  {
    header: `OR @${PROJECTION_AGE}`,
    key: "orAtAge",
    slot: "orAtAge",
    sortable: true,
    group: "Growth",
    align: "right",
    sortValue: (p: BasketballPlayer) => atAgeFor(p)?.or ?? null,
    cellStyle: (p: BasketballPlayer) =>
      heatStyle(atAgeFor(p)?.or, growthRange.value.or.min, growthRange.value.or.max, GROWTH_RAMP),
  },
  {
    header: `Skill @${POTENTIAL_AGE}`,
    key: "skillAt32",
    slot: "skillAt32",
    sortable: true,
    group: "Growth",
    align: "right",
    sortValue: (p: BasketballPlayer) => atAge32For(p)?.skill ?? null,
    cellStyle: (p: BasketballPlayer) =>
      heatStyle(atAge32For(p)?.skill, growthRange.value.skill32.min, growthRange.value.skill32.max, GROWTH_RAMP),
  },
  {
    header: `OR @${POTENTIAL_AGE}`,
    key: "orAt32",
    slot: "orAt32",
    sortable: true,
    group: "Growth",
    align: "right",
    sortValue: (p: BasketballPlayer) => atAge32For(p)?.or ?? null,
    cellStyle: (p: BasketballPlayer) =>
      heatStyle(atAge32For(p)?.or, growthRange.value.or32.min, growthRange.value.or32.max, GROWTH_RAMP),
  },
  {
    header: "Potential ★",
    key: "potential",
    slot: "potential",
    sortable: true,
    group: "Growth",
    align: "center",
    sortValue: (p: BasketballPlayer) => potentialFor(p)?.ratingWithXp ?? null,
  },

  ...POSITIONS.map(positionColumn),

  {
    header: "History",
    key: "history",
    slot: "history",
    sortable: true,
    group: "Data",
    sortValue: (p: BasketballPlayer) => summaries.value.get(idOf(p))?.days ?? 0,
  },
  {
    header: "Last Updated",
    key: "updatedAt",
    slot: "updatedAt",
    sortable: true,
    group: "Data",
    sortValue: (p: BasketballPlayer) => p.updatedAt.getTime(),
  },
]);

/** "gold tier, 22%" - the tiering RatingStars draws, on basketball's scale. */
const tierLabel = (value: number) => {
  const { low, medium, high } = ratingSettings;
  const [tier, from, to] =
    value < low ? ["silver", 0, low] : value < medium ? ["gold", low, medium] : ["diamond", medium, high];
  return `${tier} tier, ${Math.min(100, Math.round(((value - from) / (to - from)) * 100))}%`;
};

const historyTitle = (player: BasketballPlayer) => {
  const summary = summaries.value.get(idOf(player));
  if (!summary) return "No history stored yet - it builds from squad overview and profile visits";
  return `${summary.days} days, ${summary.firstDate} - ${summary.lastDate}`;
};

const formatDate = (date: Date) =>
  `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

const profileUrl = (player: BasketballPlayer) =>
  buildPlayerProfileUrl(
    "basketball",
    lang.value,
    getLocalizedPageForLang(routes.playerProfile, lang.value, "player-profile.html"),
    idOf(player)
  );
</script>

<template>
  <div class="full-player-table basketball-report">
    <div class="bb-header white_box">
      <h2>Basketball players - cached data</h2>
      <span>Total cached: {{ players.length }}</span>
      <span v-if="historyStats" class="history-stats">
        History: {{ historyStats.records.toLocaleString() }} records ·
        {{ historyStats.players }} players
      </span>
      <span
        class="history-stats"
        title="Players seen on other teams' Players pages (and your own squad). They draw the League and Elite lines of the Growth Comparison chart."
      >
        Scouted: {{ scoutedCoverage.players.toLocaleString() }} players ·
        {{ scoutedCoverage.teams }} teams
      </span>
      <span class="bb-header__note">
        Backup and Clear are on the Hockey tab - they cover every sport.
      </span>
    </div>

    <div class="view-tabs white_box">
      <button :class="{ active: activeTab === 'table' }" @click="activeTab = 'table'">Table</button>
      <button :class="{ active: activeTab === 'graph' }" @click="activeTab = 'graph'">
        Growth Comparison
      </button>
    </div>

    <div class="filters white_box compare">
      <div class="filter-group">
        <label>Compare with:</label>
        <button
          v-for="option in COMPARE_OPTIONS"
          :key="option.key"
          :class="{ active: compareWith === option.key }"
          @click="compareWith = option.key"
        >
          {{ option.name }}
        </button>
      </div>
      <span class="compare__caption">{{ compareCaption }}</span>
    </div>

    <div class="filters white_box">
      <div class="filter-group">
        <label>Team:</label>
        <button
          v-for="team in TEAM_OPTIONS"
          :key="team"
          :class="{ active: effectiveTeam === team }"
          :disabled="team !== 'All' && !teamKnown"
          @click="selectedTeam = team"
        >
          {{ team }} ({{ teamCount(team) }})
        </button>
      </div>
      <div class="filter-group">
        <label>Position:</label>
        <button
          v-for="position in ['All', ...POSITIONS]"
          :key="position"
          :class="{ active: selectedPosition === position }"
          @click="selectedPosition = position"
        >
          {{ position }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="empty-state white_box">Loading basketball players…</div>
    <div v-else-if="players.length === 0" class="empty-state white_box">
      No basketball players cached yet. Open your basketball squad overview in the game - each
      visit stores the whole squad and today's history.
    </div>
    <div v-else-if="filtered.length === 0" class="empty-state white_box">
      No players match the current filters.
    </div>

    <GrowthComparisonChart
      v-else-if="activeTab === 'graph'"
      :series="comparisonSeries"
      v-model:reference-key="chartReferenceKey"
      :reference-options="referenceOptions"
      :loading="history === null"
    />

    <template v-else>
      <p class="heat-legend">
        Shading: darker = higher within the column.
        <span class="heat-legend__swatches" aria-hidden="true">
          <span v-for="c in SKILL_RAMP" :key="c" :style="{ background: c }"></span>
        </span>
        Skills and positions
        <span class="heat-legend__swatches" aria-hidden="true">
          <span v-for="c in GROWTH_RAMP" :key="c" :style="{ background: c }"></span>
        </span>
        Growth (lowest to highest in view)
      </p>

      <details v-if="measuredCurve.length > 0" class="reference white_box">
        <summary>
          {{ paceHeader !== "Pace" ? "Squad reference (used by the @25, @32 and Potential projections)" : "Pace reference" }}:
          your best player at each age = 100%
          ({{ measuredCurve.length }} ages measured from your history)
        </summary>
        <p class="reference__note">
          Skill points per normal training day (camp and injury days left out). After the peak
          the curve never rises, so a projection can't speed up with age just because a
          different player was best. Grey ages have no squad data yet and use the default curve.
          Rebuilt from your history every time the report opens.
        </p>
        <table class="reference__table">
          <tr>
            <th>Age</th>
            <td v-for="p in curve" :key="p.age" :class="{ 'history-none': p.source === 'default' }">
              {{ p.age }}
            </td>
          </tr>
          <tr>
            <th>100% =</th>
            <td
              v-for="p in curve"
              :key="p.age"
              :class="{ 'history-none': p.source === 'default' }"
              :title="referenceTitle(p)"
            >
              {{ p.perDay.toFixed(2) }}
            </td>
          </tr>
        </table>
      </details>

      <div class="table-container report-table white_box">
        <SortableTable
          :items="filtered"
          :columns="columns"
          :defaultSort="{ key: 'skill', dir: 'desc' }"
          sticky
        >
          <template #name="{ item }">
            <a class="player-link" :href="profileUrl(item)" target="_blank" rel="noopener">
              {{ item.name }}
            </a>
          </template>
          <template #position="{ item }">
            <span class="position-chip">{{ item.getBestPosition().name }}</span>
          </template>
          <template #skill="{ item }">{{ item.getBestPosition().ratingWithXp }}</template>
          <template #skillStars="{ item }">
            <span :title="`${item.getBestPosition().ratingWithXp} (skill with XP) - ${tierLabel(item.getBestPosition().ratingWithXp)}`">
              <RatingStars :skill="item.getBestPosition().ratingWithXp" :settings="ratingSettings" />
            </span>
          </template>
          <template #positionTQ="{ item }">
            {{ item.getBestPositionTrainingQuality().totalTrainingQuality || "-" }}
          </template>
          <template #orVsBest="{ item }">
            <span v-if="orVsBestFor(item)" :title="orVsBestTitle(item)">
              {{ Math.round(orVsBestFor(item)!.share * 100) }}%
            </span>
            <span v-else class="history-none" :title="orVsBestTitle(item)">-</span>
          </template>
          <template #pace="{ item }">
            <span
              v-if="shownPaceFor(item)"
              :class="{ projected: shownPaceFor(item)!.provisional }"
              :title="shownPaceFor(item)!.title"
            >
              {{ shownPaceFor(item)!.provisional ? "~" : "" }}{{ Math.round(shownPaceFor(item)!.pace * 100) }}%
            </span>
            <span v-else class="history-none" :title="shownPaceMissingTitle(item)">-</span>
          </template>
          <template #skillAtAge="{ item }">
            <span
              v-if="atAgeFor(item)?.skill != null"
              :class="{ projected: atAgeFor(item)!.kind === 'projected' }"
              :title="atAgeFor(item)!.title"
            >
              {{ atAgeFor(item)!.kind === "projected" ? "~" : "" }}{{ atAgeFor(item)!.skill }}
            </span>
            <span v-else class="history-none" :title="atAgeMissingTitle(item)">-</span>
          </template>
          <template #orAtAge="{ item }">
            <span
              v-if="atAgeFor(item)?.or != null"
              :class="{ projected: atAgeFor(item)!.kind === 'projected' }"
              :title="atAgeFor(item)!.title"
            >
              {{ atAgeFor(item)!.kind === "projected" ? "~" : "" }}{{ atAgeFor(item)!.or }}
            </span>
            <span v-else class="history-none" :title="atAgeMissingTitle(item)">-</span>
          </template>
          <template #skillAt32="{ item }">
            <span
              v-if="atAge32For(item)?.skill != null"
              :class="{ projected: atAge32For(item)!.kind === 'projected' }"
              :title="atAge32For(item)!.title"
            >
              {{ atAge32For(item)!.kind === "projected" ? "~" : "" }}{{ atAge32For(item)!.skill }}
            </span>
            <span v-else class="history-none" :title="atAgeMissingTitle(item, POTENTIAL_AGE)">-</span>
          </template>
          <template #orAt32="{ item }">
            <span
              v-if="atAge32For(item)?.or != null"
              :class="{ projected: atAge32For(item)!.kind === 'projected' }"
              :title="atAge32For(item)!.title"
            >
              {{ atAge32For(item)!.kind === "projected" ? "~" : "" }}{{ atAge32For(item)!.or }}
            </span>
            <span v-else class="history-none" :title="atAgeMissingTitle(item, POTENTIAL_AGE)">-</span>
          </template>
          <template #potential="{ item }">
            <span v-if="potentialFor(item)" :title="potentialTitle(item)">
              <RatingStars :skill="potentialFor(item)!.ratingWithXp" :settings="ratingSettings" />
            </span>
            <span v-else class="history-none" :title="potentialTitle(item)">-</span>
          </template>
          <template v-for="name in POSITIONS" :key="name" #[`position-${name}`]="{ item }">
            {{ positionRating(item, name) ?? "-" }}
          </template>
          <template #history="{ item }">
            <span v-if="summaries.get(idOf(item))" class="history-cell" :title="historyTitle(item)">
              <span>{{ summaries.get(idOf(item))!.days }}d</span>
              <span class="history-since">{{ summaries.get(idOf(item))!.firstDate.slice(5) }}</span>
            </span>
            <span v-else class="history-none" :title="historyTitle(item)">-</span>
          </template>
          <template #updatedAt="{ item }">{{ formatDate(item.updatedAt) }}</template>
        </SortableTable>
      </div>
    </template>
  </div>
</template>

<style scoped>
.bb-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 16px;
}

.bb-header h2 {
  margin: 0;
  font-size: 20px;
}

.view-tabs {
  display: flex;
  gap: 8px;
}

.view-tabs button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.view-tabs button:hover {
  background: #f8f9fa;
}

.view-tabs button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.reference {
  margin: 0 0 12px;
  font-size: 13px;
}

.reference summary {
  cursor: pointer;
  font-weight: 600;
}

.reference__note {
  margin: 8px 0;
  color: #666;
}

.reference__table {
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.reference__table th,
.reference__table td {
  padding: 2px 8px;
  text-align: right;
  border-bottom: 1px solid #eee;
}

.bb-header__note {
  margin-left: auto;
  font-size: 12px;
  color: #888;
}

.compare__caption {
  font-size: 12px;
  color: #666;
}
</style>
