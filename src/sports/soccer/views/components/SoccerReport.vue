<script setup lang="ts">
/**
 * The soccer Player Report: every cached soccer player in one grouped,
 * heatmapped table, plus the growth comparison chart. Same look as hockey's
 * and basketball's (shared SortableTable, heatmap, reportTable.css and
 * GrowthComparisonChart), soccer's own columns.
 *
 * Growth columns (pace, @25, potential) use the shared growth model with
 * soccer's constants - src/sports/soccer/growthPace.ts and
 * docs/skill-history.md, Soccer. Backup and Clear live on the Hockey tab;
 * they already cover every sport.
 */
import { computed, onMounted, ref, watch } from "vue";
import { SoccerPlayer, SoccerSkills } from "@/sports/soccer/classes/SoccerPlayer";
import { StoredSoccerPlayer, deserializeSoccerPlayer } from "@/sports/soccer/capture";
import { normalizePlayerId } from "@/base/captureUtils";
import { positionSettings, ratingSettings } from "@/sports/soccer/settings";
import { soccerPlayerProfile } from "@/sports/soccer/playerProfile";
import { getSoccerPlayerPageForLang } from "@/sports/soccer/routes";
import {
  soccerEntryAge,
  soccerEntryOverall,
  soccerHistoryPoints,
  topPlayerSkillCurve,
} from "@/sports/soccer/historyChart";
import { useCompareWith } from "@/base/scout/useCompareWith";
import { squadBestOrByAge, squadHistoryOnly } from "@/base/scout/scoutReference";
import { exportScoutSnapshots, readLeagueTeams } from "@/storage/scoutSnapshotDb";
import { LeagueTeams, ScoutSnapshot } from "@/types/ScoutSnapshot";
import {
  CAMP_UNTIL_AGE,
  PACE_MIN_SPAN_DAYS,
  PACE_PROVISIONAL_MIN_DAYS,
  PACE_WINDOW_DAYS,
  POTENTIAL_AGE,
  Potential,
  SoccerGrowthPace,
  bestPositionRating,
  dateAtAge,
  entryNearestDate,
  expectedSeasonGain,
  measureGrowthPace,
  overallFromSkills,
  projectOverallRating,
  projectPositionRating,
  projectPotential,
} from "@/sports/soccer/growthPace";
import { readSportTeamCache } from "@/storage/playerCache";
import { exportSkillHistory } from "@/storage/skillHistoryDb";
import { groupByPlayer, statsFrom, summariesFrom } from "@/storage/historyQueries";
import { getUserSettings } from "@/storage/userSettings";
import { SkillHistoryEntry, SkillHistoryStats, SkillHistorySummary } from "@/types/SkillHistory";
import { buildPlayerProfileUrl } from "@/utils/parsers";
import SortableTable, { type Column } from "@/components/SortableTable.vue";
import RatingStars from "@/components/RatingStars.vue";
import CompareWithBar from "@/components/CompareWithBar.vue";
import PercentCell from "@/components/PercentCell.vue";
import GrowthComparisonChart, {
  type GrowthReference,
  type GrowthSeries,
} from "@/components/GrowthComparisonChart.vue";
import { GROWTH_RAMP, SKILL_RAMP, heatStyle } from "@/components/heatmap";
import "@/components/reportTable.css";

const loading = ref(true);
const players = ref<SoccerPlayer[]>([]);
const teamId = ref("unknown");
const squad = ref<{ playerIds: string[]; updatedAt: string } | null>(null);
const summaries = ref<Map<string, SkillHistorySummary>>(new Map());
const historyStats = ref<SkillHistoryStats | null>(null);
const lang = ref("en");
const seasonDay = ref(1);
// Every stored soccer day by player, for the comparison chart. Null when the
// read failed, so the chart says so rather than drawing nobody.
const history = ref<Map<string, SkillHistoryEntry<SoccerSkills>[]> | null>(new Map());
// Other teams' rosters and the user's league, for League / Elite.
const scoutSnapshots = ref<ScoutSnapshot[]>([]);
const league = ref<LeagueTeams | null>(null);

onMounted(async () => {
  // One full read of the history; summaries and stats are worked out from it
  // (src/storage/historyQueries.ts) rather than asked of the worker again.
  const [cache, settings, allHistory, scouted, leagueTeams] =
    await Promise.all([
      readSportTeamCache<StoredSoccerPlayer>("soccer"),
      getUserSettings(),
      exportSkillHistory("soccer"),
      exportScoutSnapshots("soccer"),
      readLeagueTeams("soccer"),
    ]);
  // A failed read leaves the scouted lines empty; nothing else depends on them.
  scoutSnapshots.value = scouted ?? [];
  league.value = leagueTeams;
  if (cache) {
    players.value = Object.values(cache.players).map(deserializeSoccerPlayer);
    teamId.value = cache.teamId;
    squad.value = cache.squad ?? null;
    seasonDay.value = cache.currentSeasonDay || 1;
  }
  lang.value = settings.lang;
  if (allHistory === null) {
    history.value = null;
  } else {
    const entries = allHistory as unknown as SkillHistoryEntry<SoccerSkills>[];
    const byPlayer = groupByPlayer(entries);
    history.value = byPlayer;
    summaries.value = summariesFrom(byPlayer);
    historyStats.value = await statsFrom(entries);
  }
  loading.value = false;
});

const idOf = (player: SoccerPlayer) => normalizePlayerId(player.id) ?? player.id;
const exactAgeOf = (player: SoccerPlayer) =>
  player.age + seasonDay.value / soccerPlayerProfile.daysPerSeason;

// --- Growth ----------------------------------------------------------------------
// Computed once per load, not per cell: the columns and their sorts share them.
// The model is hockey's, shared (src/base/growthModel.ts), with soccer's
// constants (src/sports/soccer/growthPace.ts).

/** The age the @25 columns report: projected for younger players, recorded for older. */
const PROJECTION_AGE = 25;
/** How far from the computed "turned 25" date a recorded day may be. */
const AT_AGE_TOLERANCE_DAYS = 14;

const entriesFor = (player: SoccerPlayer) => history.value?.get(idOf(player)) ?? [];

const paceByPlayer = computed(() => {
  const paces = new Map<string, SoccerGrowthPace | null>();
  if (!history.value) return paces;
  players.value.forEach((player) => {
    // Paced for the current best position - projections assume balanced
    // training for it from here on.
    paces.set(
      idOf(player),
      measureGrowthPace(entriesFor(player), exactAgeOf(player), player.getBestPosition().name)
    );
  });
  return paces;
});
const paceFor = (player: SoccerPlayer) => paceByPlayer.value.get(idOf(player)) ?? null;

const signed = (value: number) => `${value >= 0 ? "+" : ""}${Math.round(value)}`;

const paceTitle = (player: SoccerPlayer) => {
  const pace = paceFor(player);
  if (!pace) {
    if (history.value === null) return "History could not be loaded";
    const stored = summaries.value.get(idOf(player))?.days ?? 0;
    return (
      `Needs ${PACE_PROVISIONAL_MIN_DAYS} days of training within the last ${PACE_WINDOW_DAYS} ` +
      `days of history (${stored} day${stored === 1 ? "" : "s"} stored)`
    );
  }
  const age = Math.floor(pace.midAge);
  const lines = [
    `${signed(pace.pointsPerSeason)} skill points/season into ${pace.position} skills ` +
      `= ${signed(pace.basePerSeason)} base/season when balanced`,
    `${signed(pace.bonusPerSeason)} bonus/season = ${signed(pace.gainPerSeason)} rating/season (no XP)`,
    `(${pace.measuredDays} days measured, ${pace.fromDate} to ${pace.toDate})`,
    pace.expectedPerSeason === null
      ? "No reference pace to compare against at this age"
      : `100% at ${age}: ${signed(pace.expectedPerSeason)}/season - ` +
        (age <= 23 ? "the top-player table" : "your squad's own slowdown after 23"),
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
  if (pace.provisional) {
    lines.unshift(`Provisional: only ${pace.measuredDays} days of data - settles at ${PACE_MIN_SPAN_DAYS}`);
  }
  return lines.join("\n");
};

/** How the projection accounts for camps, for the @25 title. */
const campAllowanceText = (pace: SoccerGrowthPace, exactAge: number) => {
  if (exactAge >= CAMP_UNTIL_AGE) return "";
  if (pace.campDaysPerSeason === 0) return "No camps last season, so none are assumed. ";
  return (
    `Includes ${pace.campDaysPerSeason} camp days a season until ${CAMP_UNTIL_AGE} ` +
    (pace.campDaysAssumed ? "(assumed: less than a season of history). " : "(from last season). ")
  );
};

/**
 * Skill and OR at PROJECTION_AGE: recorded from history for players past it,
 * projected for younger ones. One shape for both, so a 19-year-old's
 * projection sorts against what a 27-year-old actually reached.
 */
type AtAgeValue = { skill: number | null; or: number | null; kind: "recorded" | "projected"; title: string };

const atAgeValues = (targetAge: number) => {
  const values = new Map<string, AtAgeValue | null>();
  players.value.forEach((player) => {
    const id = idOf(player);
    const exactAge = exactAgeOf(player);

    if (exactAge >= targetAge) {
      const entry = entryNearestDate(
        entriesFor(player),
        dateAtAge(exactAge, targetAge),
        AT_AGE_TOLERANCE_DAYS
      );
      if (!entry) {
        values.set(id, null);
        return;
      }
      const best = bestPositionRating(entry.skills);
      values.set(id, {
        skill: best.rating,
        or: entry.overallRating ?? overallFromSkills(entry.skills),
        kind: "recorded",
        title: `Recorded ${entry.date}, when the player was about ${targetAge} (best position ${best.name}, no XP)`,
      });
      return;
    }

    const pace = paceFor(player);
    if (pace?.pace === null || pace?.pace === undefined) {
      values.set(id, null);
      return;
    }
    values.set(id, {
      skill: projectPositionRating(player.skills, exactAge, pace, targetAge),
      or: projectOverallRating(player.skills, exactAge, pace, targetAge),
      kind: "projected",
      title:
        `Projected: ${pace.position} rating (no XP) at ${targetAge}, assuming balanced ` +
        `${pace.position} training at ${Math.round(pace.pace * 100)}% of the reference pace from ` +
        "here on (the top-player table to 23, your squad's own slowdown after). Any lagging main " +
        "skill is caught up first; other skills keep their current rate. " +
        campAllowanceText(pace, exactAge) +
        (pace.provisional ? `Provisional: the pace rests on only ${pace.measuredDays} days of data.` : ""),
    });
  });
  return values;
};
const atAgeByPlayer = computed(() => atAgeValues(PROJECTION_AGE));
// The same at 32: the skill and OR behind Potential's stars (which add XP).
const atAge32ByPlayer = computed(() => atAgeValues(POTENTIAL_AGE));
const atAgeFor = (player: SoccerPlayer) => atAgeByPlayer.value.get(idOf(player)) ?? null;

const atAge32For = (player: SoccerPlayer) => atAge32ByPlayer.value.get(idOf(player)) ?? null;
const atAgeMissingTitle = (player: SoccerPlayer, targetAge = PROJECTION_AGE) => {
  if (history.value === null) return "History could not be loaded";
  if (exactAgeOf(player) >= targetAge) {
    return `No stored day with skills within ${AT_AGE_TOLERANCE_DAYS} days of when the player turned ${targetAge}`;
  }
  return "No pace to project from";
};

const potentialByPlayer = computed(() => {
  const values = new Map<string, Potential | null>();
  players.value.forEach((player) => {
    const best = player.getBestPosition();
    values.set(
      idOf(player),
      projectPotential(player.skills, player.experience, exactAgeOf(player), paceFor(player), {
        rating: best.ratingWithBonus,
        ratingWithXp: best.ratingWithXp,
      })
    );
  });
  return values;
});
const potentialFor = (player: SoccerPlayer) => potentialByPlayer.value.get(idOf(player)) ?? null;

const potentialTitle = (player: SoccerPlayer) => {
  const potential = potentialFor(player);
  if (!potential) return "No pace to project from";
  if (potential.kind === "current") {
    return (
      `${potential.ratingWithXp} now - at or past peak age (${POTENTIAL_AGE}), so this is the ` +
      `current skill with XP. ${tierLabel(potential.ratingWithXp)}`
    );
  }
  return (
    `~${potential.ratingWithXp} at ${POTENTIAL_AGE}: rating ~${potential.rating} (no XP) + XP ` +
    `~${Math.round(potential.xp)}. ${tierLabel(potential.ratingWithXp)}. Same model as Skill ` +
    `@${PROJECTION_AGE}, extended to ${POTENTIAL_AGE}; XP grows at the squad's typical rate ` +
    "from here (past playing time elsewhere doesn't carry over)."
  );
};

// --- Filters -------------------------------------------------------------------
// Same team rule as the other sports: the squad overview's roster when there
// is one (exact - sold players drop out), else the cache's team id.

const TEAM_FILTER_KEY = "ppm-assistant:report:soccer:team";
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
const isMyPlayer = (player: SoccerPlayer) =>
  ownSquad.value ? ownSquad.value.has(idOf(player)) : player.teamId === teamId.value;
const teamKnown = computed(() => squad.value !== null || teamId.value !== "unknown");
const effectiveTeam = computed<TeamOption>(() => (teamKnown.value ? selectedTeam.value : "All"));
const matchesTeam = (player: SoccerPlayer, team: TeamOption) =>
  team === "All" || (team === "My team") === isMyPlayer(player);
const teamCount = (team: TeamOption) => players.value.filter((p) => matchesTeam(p, team)).length;

const POSITIONS = positionSettings.map((position) => position.name);
const selectedPosition = ref("All");

const filtered = computed(() =>
  players.value.filter(
    (player) =>
      matchesTeam(player, effectiveTeam.value) &&
      (selectedPosition.value === "All" || player.getBestPosition().name === selectedPosition.value)
  )
);

// --- Table ---------------------------------------------------------------------

type SkillKey = keyof SoccerSkills;
const SKILL_COLUMNS: [string, SkillKey][] = [
  ["Goa", "goalie"],
  ["Def", "defence"],
  ["Mid", "midfield"],
  ["Off", "offence"],
  ["Sho", "shooting"],
  ["Pas", "passing"],
  ["Tec", "technical"],
  ["Spe", "speed"],
  ["Hea", "heading"],
];

const positionRating = (player: SoccerPlayer, name: string) =>
  player.getPositions().find((position) => position.name === name)?.ratingWithXp ?? null;

// Skills and position ratings each shade against their own column's max in view.
const columnMax = computed(() => {
  const max = (read: (p: SoccerPlayer) => number | null | undefined) =>
    Math.max(0, ...filtered.value.map((p) => read(p) ?? 0));
  const result: Record<string, number> = {};
  SKILL_COLUMNS.forEach(([, key]) => (result[key] = max((p) => p.skills?.[key])));
  POSITIONS.forEach((name) => (result[name] = max((p) => positionRating(p, name))));
  return result;
});

// Growth columns shade min..max over the players that have a value.
const growthRange = computed(() => {
  const range = (read: (p: SoccerPlayer) => number | null | undefined) => {
    const values = filtered.value
      .map(read)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    return values.length > 0 ? { min: Math.min(...values), max: Math.max(...values) } : { min: 0, max: 0 };
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
  sortValue: (p: SoccerPlayer) => p.skills?.[key] ?? 0,
  cellStyle: (p: SoccerPlayer) => heatStyle(p.skills?.[key], 0, columnMax.value[key], SKILL_RAMP),
});

const positionColumn = (name: string): Column => ({
  header: name,
  key: `position-${name}`,
  slot: `position-${name}`,
  group: "All positions",
  align: "right",
  sortable: true,
  sortValue: (p: SoccerPlayer) => positionRating(p, name),
  cellStyle: (p: SoccerPlayer) => heatStyle(positionRating(p, name), 0, columnMax.value[name], SKILL_RAMP),
});

const columns = computed<Column[]>(() => [
  { header: "Name", key: "name", slot: "name", sortable: true, cellClass: "name-cell", group: "Player" },
  { header: "Age", key: "age", sortable: true, group: "Player", align: "right" },
  { header: "CL", key: "careerLongitivity", sortable: true, group: "Player", align: "right" },
  { header: "OR", key: "overallRating", sortable: true, group: "Player", align: "right" },
  { header: "Exp", key: "experience", sortable: true, group: "Player", align: "right" },

  ...SKILL_COLUMNS.map(([header, key]) => skillColumn(header, key)),

  {
    header: "Best Pos",
    key: "position",
    slot: "position",
    sortable: true,
    group: "Position",
    align: "center",
    sortValue: (p: SoccerPlayer) => p.getBestPosition().name,
  },
  {
    header: "Pos Skill",
    key: "skill",
    slot: "skill",
    sortable: true,
    group: "Position",
    align: "right",
    sortValue: (p: SoccerPlayer) => p.getBestPosition().ratingWithXp,
  },
  {
    header: "Skill ★",
    key: "skillStars",
    slot: "skillStars",
    sortable: true,
    group: "Position",
    align: "center",
    sortValue: (p: SoccerPlayer) => p.getBestPosition().ratingWithXp,
  },
  {
    header: "Pos TQ",
    key: "positionTQ",
    slot: "positionTQ",
    sortable: true,
    group: "Position",
    align: "right",
    sortValue: (p: SoccerPlayer) =>
      p.trainingQualities ? p.getBestPositionTrainingQuality().totalTrainingQuality : null,
  },

  ...compareColumns(growthRange.value),
  {
    header: `Skill @${PROJECTION_AGE}`,
    key: "skillAtAge",
    slot: "skillAtAge",
    sortable: true,
    group: "Growth",
    align: "right",
    sortValue: (p: SoccerPlayer) => atAgeFor(p)?.skill ?? null,
    cellStyle: (p: SoccerPlayer) =>
      heatStyle(atAgeFor(p)?.skill, growthRange.value.skill.min, growthRange.value.skill.max, GROWTH_RAMP),
  },
  {
    header: `OR @${PROJECTION_AGE}`,
    key: "orAtAge",
    slot: "orAtAge",
    sortable: true,
    group: "Growth",
    align: "right",
    sortValue: (p: SoccerPlayer) => atAgeFor(p)?.or ?? null,
    cellStyle: (p: SoccerPlayer) =>
      heatStyle(atAgeFor(p)?.or, growthRange.value.or.min, growthRange.value.or.max, GROWTH_RAMP),
  },
  {
    header: `Skill @${POTENTIAL_AGE}`,
    key: "skillAt32",
    slot: "skillAt32",
    sortable: true,
    group: "Growth",
    align: "right",
    sortValue: (p: SoccerPlayer) => atAge32For(p)?.skill ?? null,
    cellStyle: (p: SoccerPlayer) =>
      heatStyle(atAge32For(p)?.skill, growthRange.value.skill32.min, growthRange.value.skill32.max, GROWTH_RAMP),
  },
  {
    header: `OR @${POTENTIAL_AGE}`,
    key: "orAt32",
    slot: "orAt32",
    sortable: true,
    group: "Growth",
    align: "right",
    sortValue: (p: SoccerPlayer) => atAge32For(p)?.or ?? null,
    cellStyle: (p: SoccerPlayer) =>
      heatStyle(atAge32For(p)?.or, growthRange.value.or32.min, growthRange.value.or32.max, GROWTH_RAMP),
  },
  {
    header: "Potential ★",
    key: "potential",
    slot: "potential",
    sortable: true,
    group: "Growth",
    align: "center",
    sortValue: (p: SoccerPlayer) => potentialFor(p)?.ratingWithXp ?? null,
  },

  ...POSITIONS.map(positionColumn),

  {
    header: "History",
    key: "history",
    slot: "history",
    sortable: true,
    group: "Data",
    sortValue: (p: SoccerPlayer) => summaries.value.get(idOf(p))?.days ?? 0,
  },
  {
    header: "Last Updated",
    key: "updatedAt",
    slot: "updatedAt",
    sortable: true,
    group: "Data",
    sortValue: (p: SoccerPlayer) => p.updatedAt.getTime(),
  },
]);

/** "gold tier, 22%" - the tiering RatingStars draws, on soccer's 400/800/1200 scale. */
const tierLabel = (value: number) => {
  const { low, medium, high } = ratingSettings;
  const [tier, from, to] =
    value < low ? ["silver", 0, low] : value < medium ? ["gold", low, medium] : ["diamond", medium, high];
  return `${tier} tier, ${Math.min(100, Math.round(((value - from) / (to - from)) * 100))}%`;
};

const historyTitle = (player: SoccerPlayer) => {
  const summary = summaries.value.get(idOf(player));
  if (!summary) {
    return "No history stored yet - open the player's Training progress and press Gather history";
  }
  return `${summary.days} days, ${summary.firstDate} - ${summary.lastDate}`;
};

const formatDate = (date: Date) =>
  `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

const profileUrl = (player: SoccerPlayer) =>
  buildPlayerProfileUrl("soccer", lang.value, getSoccerPlayerPageForLang(lang.value), idOf(player));

// --- Growth comparison chart ------------------------------------------------------

const activeTab = ref<"table" | "graph">("table");

// Every filtered player's history; a player without stored days shows as a
// dot at today's value.
const comparisonSeries = computed<GrowthSeries[]>(() =>
  filtered.value.map((player) => {
    const entries = history.value?.get(idOf(player)) ?? [];
    const exactAge = exactAgeOf(player);
    const skill = soccerHistoryPoints(entries, exactAge, "skill");
    const or = soccerHistoryPoints(entries, exactAge, "or");
    return {
      id: idOf(player),
      label: player.name,
      skill: skill.length > 0 ? skill : [{ x: exactAge, y: player.getBestPosition().ratingWithBonus }],
      or: or.length > 0 ? or : [{ x: exactAge, y: player.overallRating }],
    };
  })
);

// --- Compare with: Squad / League / Elite ------------------------------------------
// Shared with the other sports' reports - see src/base/scout/useCompareWith.ts.
// Under Squad (and until a group has enough revisits) Pace is soccer's own,
// against the reference table; projections never follow the toggle.

// The Squad choice: the top-player table's rating on the Skill tab, as before,
// and the squad's own best OR at each age on the OR tab.
const squadReference = computed<GrowthReference>(() => ({
  label: "Top player (Skill) / your squad's best (OR)",
  skill: topPlayerSkillCurve,
  or: squadBestOrByAge(
    // Opponents opened on their profile are in the history too - not "your squad".
    squadHistoryOnly(history.value ?? new Map()),
    new Map(players.value.map((player) => [idOf(player), exactAgeOf(player)])),
    soccerPlayerProfile.daysPerSeason,
    soccerEntryOverall,
    new Map(players.value.map((player) => [idOf(player), player.name]))
  ),
}));

const {
  COMPARE_OPTIONS,
  compareColumns,
  compareWith,
  chartReferenceKey,
  compareCaption,
  referenceOptions,
  scoutedCoverage,
  orVsBestFor,
  orVsBestTitle,
  shownPaceFor,
  shownPaceMissingTitle,
} = useCompareWith<SoccerPlayer>({
  sport: "soccer",
  daysPerSeason: soccerPlayerProfile.daysPerSeason,
  players: () => players.value,
  snapshots: () => scoutSnapshots.value,
  league: () => league.value,
  ownTeamId: () => teamId.value,
  squadReference: () => squadReference.value,
  squadChartCaption:
    "Skill: the top-player table the Pace column measures against. OR: the best any of your own players had on reaching each age.",
  squadCaption:
    "Squad: OR against the best any of your own players had at the same age. Pace: against the reference table, as before.",
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
      const or = soccerEntryOverall(entry);
      return or !== null ? [{ date: entry.date, or }] : [];
    }),
  ageOnDate: (player, date) => soccerEntryAge(date, exactAgeOf(player)),
  rateShape: (age) => expectedSeasonGain(age) ?? 0,
});
</script>

<template>
  <div class="full-player-table soccer-report">
    <div class="soccer-header white_box">
      <h2>Soccer players - cached data</h2>
      <span>Total cached: {{ players.length }}</span>
      <span v-if="historyStats" class="history-stats">
        History: {{ historyStats.records.toLocaleString() }} records ·
        {{ historyStats.players }} players
      </span>
      <span
        class="history-stats"
        title="Players seen on other teams' Players pages (and your own squad). They draw the League and Elite lines."
      >
        Scouted: {{ scoutedCoverage.players.toLocaleString() }} players ·
        {{ scoutedCoverage.teams }} teams
      </span>
      <span class="soccer-header__note">
        Backup and Clear are on the Hockey tab - they cover every sport.
      </span>
    </div>

    <div class="view-tabs white_box">
      <button :class="{ active: activeTab === 'table' }" @click="activeTab = 'table'">Table</button>
      <button :class="{ active: activeTab === 'graph' }" @click="activeTab = 'graph'">
        Growth Comparison
      </button>
    </div>

    <CompareWithBar v-model="compareWith" :options="COMPARE_OPTIONS" :caption="compareCaption" />

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

    <div v-if="loading" class="empty-state white_box">Loading soccer players…</div>
    <div v-else-if="players.length === 0" class="empty-state white_box">
      No soccer players cached yet. Open your soccer squad overview in the game - each visit
      stores the whole squad and today's history.
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

      <div class="table-container report-table white_box">
        <SortableTable :items="filtered" :columns="columns" :defaultSort="{ key: 'skill', dir: 'desc' }" sticky>
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
            <span
              :title="`${item.getBestPosition().ratingWithXp} (skill with XP) - ${tierLabel(item.getBestPosition().ratingWithXp)}`"
            >
              <RatingStars :skill="item.getBestPosition().ratingWithXp" :settings="ratingSettings" />
            </span>
          </template>
          <template #positionTQ="{ item }">
            {{ item.trainingQualities ? item.getBestPositionTrainingQuality().totalTrainingQuality : "-" }}
          </template>
          <template #orVsBest="{ item }">
            <PercentCell :value="orVsBestFor(item)?.share" :title="orVsBestTitle(item)" />
          </template>
          <template #pace="{ item }">
            <PercentCell
              :value="shownPaceFor(item)?.pace"
              :provisional="shownPaceFor(item)?.provisional"
              :title="shownPaceFor(item)?.title ?? shownPaceMissingTitle(item)"
            />
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
              <span class="history-since">{{ summaries.get(idOf(item))!.firstDate.slice(0, 7) }}</span>
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
.soccer-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 16px;
}

.soccer-header h2 {
  margin: 0;
  font-size: 20px;
}

.soccer-header__note {
  margin-left: auto;
  font-size: 12px;
  color: #888;
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

</style>
