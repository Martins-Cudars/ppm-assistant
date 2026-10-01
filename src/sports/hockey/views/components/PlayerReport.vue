<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { usePlayerStore } from "@/stores/playerStore";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { calculateCompleteness } from "@/storage/serialization";
import {
  getLatestSkillHistoryWindow,
  getSkillHistoryNearDates,
  getSkillHistoryStats,
  getSkillHistorySummaries,
} from "@/storage/skillHistoryDb";
import { SkillHistoryEntry, SkillHistoryStats, SkillHistorySummary } from "@/types/SkillHistory";
import { getExactAge, readEntryOverallRating } from "@/sports/hockey/skillHistoryChart";
import {
  CAMP_LOOKBACK_DAYS,
  CAMP_UNTIL_AGE,
  GrowthPace,
  PACE_MIN_SPAN_DAYS,
  PACE_PROVISIONAL_MIN_DAYS,
  PACE_WINDOW_DAYS,
  bestPositionRating,
  dateAtAge,
  entryNearestDate,
  measureGrowthPace,
  POTENTIAL_AGE,
  Potential,
  projectPotential,
  overallFromSkills,
  projectOverallRating,
  projectPositionRating,
} from "@/sports/hockey/growthPace";
import { buildPlayerProfileUrl } from "@/utils/parsers";
import {
  createBackup,
  downloadBackup,
  parseBackup,
  restoreBackup,
} from "@/storage/backup";
import { ImportMode, ParsedBackup } from "@/types/Backup";
import PlayerDataFreshness from "./PlayerDataFreshness.vue";
import PlayerGrowthComparisonChart from "./PlayerGrowthComparisonChart.vue";
import SortableTable, { type Column } from "@/components/SortableTable.vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import RatingStars from "@/components/RatingStars.vue";
import { GROWTH_RAMP, SKILL_RAMP, heatStyle } from "@/components/heatmap";
import "@/components/reportTable.css";
import { ratingSettings } from "@/sports/hockey/settings";

const store = usePlayerStore();
const activeTab = ref<"table" | "graph">("table");
const selectedFreshness = ref("All");
const selectedCompleteness = ref("All");
const selectedPosition = ref("All");
const selectedHistory = ref("All");

// Team filter. The cache holds every opponent whose profile was ever opened,
// so the report opens on the user's own squad - and remembers the last choice.
// Browser storage is a per-viewer convenience here: it can be missing or throw
// (private windows, blocked site data), so every access falls back quietly.
const TEAM_FILTER_KEY = "ppm-assistant:report:team";
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

// The last squad overview's roster when there is one: exact, and it drops
// players who were sold but still carry our teamId in the cache. Otherwise,
// fall back to matching the cache's own team id.
const ownSquad = computed(() => (store.squad ? new Set(store.squad.playerIds) : null));
const isMyPlayer = (player: HockeyPlayer) =>
  ownSquad.value ? ownSquad.value.has(player.id) : player.teamId === store.teamId;

// Without a roster or a team id there's no way to tell whose player is whose;
// show everyone rather than an unexplained empty "My team". Derived, not
// written back, so the remembered choice survives until it can apply again.
const teamKnown = computed(() => store.squad !== null || store.teamId !== "unknown");
const effectiveTeam = computed<TeamOption>(() => (teamKnown.value ? selectedTeam.value : "All"));

const matchesTeam = (player: HockeyPlayer, team: TeamOption) =>
  team === "All" || (team === "My team") === isMyPlayer(player);

const getTeamCount = (team: TeamOption) =>
  store.cachedPlayers.filter((p) => matchesTeam(p, team)).length;

const myTeamTitle = computed(() => {
  if (!teamKnown.value) return "Your team isn't known yet - open the squad overview in the game";
  if (!store.squad) {
    return "Cached players with your team id. Open the squad overview to exclude players you've sold.";
  }
  return `Players on the squad overview, last saved ${new Date(store.squad.updatedAt).toLocaleString()}`;
});

// Skill-history coverage per player, keyed by player id. Populated after the
// cache loads; a player missing from the map simply has nothing stored.
const historySummaries = ref<Map<string, SkillHistorySummary>>(new Map());

// Each player's most recent weeks of history, for the Pace column. Null when
// the read failed - distinct from an empty map, so a failure shows as "-"
// rather than as every player having no measurable growth.
const recentHistory = ref<Map<string, SkillHistoryEntry[]> | null>(new Map());

/**
 * The age the @25 columns report: projected for younger players, recorded
 * from history for older ones.
 */
const PROJECTION_AGE = 25;

/**
 * How far from the computed "turned 25" date a recorded day may be. The date
 * assumes 112 calendar days per season, which drifts over many seasons.
 */
const AT_AGE_TOLERANCE_DAYS = 14;

// Entries around the day each player aged PROJECTION_AGE+ turned that age.
// Null when the read failed, so it shows as "-" rather than as "no history".
const atAgeHistory = ref<Map<string, SkillHistoryEntry[]> | null>(new Map());
// The same around POTENTIAL_AGE (32), for the @32 columns' recorded values.
const atAge32History = ref<Map<string, SkillHistoryEntry[]> | null>(new Map());

// Storage footprint of the history store, shown in the header.
const historyStats = ref<SkillHistoryStats | null>(null);

// Whether the destructive-clear confirmation is showing.
const confirmingClear = ref(false);

// Backup state. `busy` disables both buttons while a multi-megabyte export or
// import is in flight; `pendingImport` holds a parsed, validated file waiting
// for the user to pick a merge or replace; `notice` carries the one-line result
// or error shown under the header.
const backupBusy = ref<"" | "export" | "import">("");
const pendingImport = ref<ParsedBackup | null>(null);
const importMode = ref<ImportMode>("merge");
const backupNotice = ref("");
const backupError = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

// Current season day comes from the store (loaded from cache)
const currentSeasonDay = computed(() => store.currentSeasonDay);

// Re-read rather than derived, so it can also be used to resync after a clear.
const loadHistoryMeta = async () => {
  // Players already past PROJECTION_AGE get their recorded value, looked up
  // around the day each turned it. Needs the cache loaded first for ages.
  const targetsAt = (age: number) =>
    store.cachedPlayers
      .filter((player: HockeyPlayer) => exactAgeOf(player) >= age)
      .map((player: HockeyPlayer) => ({
        playerId: player.id,
        date: dateAtAge(exactAgeOf(player), age),
      }));

  // Independent of each other, so don't serialise them.
  const [summaries, stats, recent, atAge, atAge32] = await Promise.all([
    getSkillHistorySummaries(),
    getSkillHistoryStats(),
    // A full season, not just the pace window: the camp allowance reads the
    // player's last season of camps. The pace itself still uses 56 days.
    getLatestSkillHistoryWindow(CAMP_LOOKBACK_DAYS),
    getSkillHistoryNearDates(targetsAt(PROJECTION_AGE), AT_AGE_TOLERANCE_DAYS),
    getSkillHistoryNearDates(targetsAt(POTENTIAL_AGE), AT_AGE_TOLERANCE_DAYS),
  ]);
  historySummaries.value = summaries;
  historyStats.value = stats;
  recentHistory.value = recent;
  atAgeHistory.value = atAge;
  atAge32History.value = atAge32;
  if (recent === null || atAge === null || atAge32 === null) {
    setNotice(
      `Growth history could not be loaded - the Pace, @${PROJECTION_AGE} and @${POTENTIAL_AGE} columns are incomplete.`,
      true
    );
  }
};

// Computed once per load rather than per cell: the Pace and Proj columns and
// both of their sort functions all read the same value.
const paceByPlayer = computed(() => {
  const paces = new Map<string, GrowthPace | null>();
  const recent = recentHistory.value;
  if (!recent) return paces;

  store.cachedPlayers.forEach((player: HockeyPlayer) => {
    const entries = recent.get(player.id);
    // Paced for the player's current best position - the projection assumes
    // balanced training for that position from here on.
    paces.set(
      player.id,
      entries
        ? measureGrowthPace(
            entries,
            getExactAge(player, currentSeasonDay.value || 1),
            player.getBestPosition().name
          )
        : null
    );
  });
  return paces;
});

const paceFor = (player: HockeyPlayer): GrowthPace | null =>
  paceByPlayer.value.get(player.id) ?? null;

const signed = (value: number) => `${value >= 0 ? "+" : ""}${Math.round(value)}`;

/**
 * Whether the rating moved noticeably faster or slower than the points put in
 * would move it under balanced training - a bottleneck being caught up, or
 * points going into a skill that isn't the bottleneck yet.
 */
const isUnbalanced = (pace: GrowthPace) =>
  Math.abs(pace.ratingMovedPerSeason - pace.basePerSeason) >
  0.25 * Math.max(Math.abs(pace.basePerSeason), 1);

const paceTitle = (player: HockeyPlayer) => {
  const pace = paceFor(player);
  if (!pace) {
    if (recentHistory.value === null) return "Growth pace could not be loaded";
    const stored = historySummaries.value.get(player.id)?.days ?? 0;
    return (
      `Needs ${PACE_PROVISIONAL_MIN_DAYS} days of training within the last ${PACE_WINDOW_DAYS} ` +
      `days of history (${stored} day${stored === 1 ? "" : "s"} stored)`
    );
  }
  const lines = [
    `${signed(pace.pointsPerSeason)} skill points/season into ${pace.position} skills ` +
      `= ${signed(pace.basePerSeason)} base/season when balanced`,
    `${signed(pace.bonusPerSeason)} bonus/season = ${signed(pace.gainPerSeason)} rating/season (no XP)`,
    `(${pace.measuredDays} days measured, ${pace.fromDate} to ${pace.toDate})`,
    pace.expectedPerSeason === null
      ? "No top-player pace to compare against at this age"
      : `Top-player pace at ${Math.floor(pace.midAge)}: ${signed(pace.expectedPerSeason)}/season`,
  ];
  const skipped = [
    pace.skippedNoTrainingDays > 0 ? `${pace.skippedNoTrainingDays} no-training days` : "",
    pace.skippedCampDays > 0 ? `${pace.skippedCampDays} training-camp days` : "",
  ].filter(Boolean);
  if (skipped.length > 0) {
    lines.push(`Skipped ${skipped.join(" and ")} (injury, no training, or camp)`);
  }
  lines.push(
    pace.campDaysAssumed
      ? "Camp days last season: unknown (less than a season of history)"
      : `Camp days last season: ${pace.campDaysPerSeason}`
  );
  if (pace.provisional) {
    lines.unshift(
      `Provisional: only ${pace.measuredDays} days of data - settles at ${PACE_MIN_SPAN_DAYS}`
    );
  }
  if (isUnbalanced(pace)) {
    lines.push(
      `The base itself moved ${signed(pace.ratingMovedPerSeason)}/season - ` +
        "skills are unbalanced, so it won't keep moving at that rate"
    );
  }
  return lines.join("\n");
};

/** How the projection accounts for training camps, for the @25 title. */
const campAllowanceText = (pace: GrowthPace, exactAge: number) => {
  if (exactAge >= CAMP_UNTIL_AGE) return "";
  if (pace.campDaysPerSeason === 0) {
    return "No camps last season, so none are assumed.";
  }
  return (
    `Includes ${pace.campDaysPerSeason} camp days a season until ${CAMP_UNTIL_AGE} ` +
    (pace.campDaysAssumed ? "(assumed: less than a season of history)." : "(from last season).")
  );
};

/**
 * A player's skill and OR at PROJECTION_AGE: recorded from history for players
 * already past it, projected for everyone younger. One shape for both, so the
 * two columns sort a 19-year-old's projection against what a 27-year-old
 * actually reached - which is the comparison worth making.
 */
type AtAgeValue = {
  skill: number | null;
  or: number | null;
  kind: "recorded" | "projected";
  title: string;
};

const exactAgeOf = (player: HockeyPlayer) => getExactAge(player, currentSeasonDay.value || 1);

/**
 * Skill and OR at `targetAge` for every player: recorded from `nearHistory`
 * (the days around each older player's birthday) or projected. Used at 25
 * and at POTENTIAL_AGE.
 */
const atAgeValues = (
  targetAge: number,
  nearHistory: Map<string, SkillHistoryEntry[]> | null
): Map<string, AtAgeValue | null> => {
  const values = new Map<string, AtAgeValue | null>();

  store.cachedPlayers.forEach((player: HockeyPlayer) => {
    const exactAge = exactAgeOf(player);

    if (exactAge >= targetAge) {
      const target = dateAtAge(exactAge, targetAge);
      const entries = nearHistory?.get(player.id) ?? [];
      const entry = entryNearestDate(entries, target, AT_AGE_TOLERANCE_DAYS);
      if (!entry) {
        values.set(player.id, null);
        return;
      }
      const best = bestPositionRating(entry.skills);
      values.set(player.id, {
        skill: best.rating,
        or: readEntryOverallRating(entry) ?? overallFromSkills(entry.skills),
        kind: "recorded",
        title: `Recorded ${entry.date}, when the player was about ${targetAge} (best position ${best.name}, no XP)`,
      });
      return;
    }

    // Projects from the live skills, so it starts from the same rating the Pos
    // Skill column's base and the profile chart's current point show.
    const pace = paceFor(player);
    if (pace?.pace === null || pace?.pace === undefined) {
      values.set(player.id, null);
      return;
    }
    values.set(player.id, {
      skill: projectPositionRating(player.skills, exactAge, pace, targetAge),
      or: projectOverallRating(player.skills, exactAge, pace, targetAge),
      kind: "projected",
      title:
        `Projected: ${pace.position} rating (no XP) at ${targetAge}, assuming balanced ` +
        `${pace.position} training at ${Math.round(pace.pace * 100)}% of the top-player pace ` +
        "from here on, slowing slightly from 22 and more from 25, as this team's players do. Any lagging main " +
        "skill is caught up first; other skills keep their current rate. " +
        campAllowanceText(pace, exactAge) +
        (pace.provisional
          ? ` Provisional: the pace rests on only ${pace.measuredDays} days of data.`
          : ""),
    });
  });
  return values;
};

const atAgeByPlayer = computed(() => atAgeValues(PROJECTION_AGE, atAgeHistory.value));
// The same at 32: the skill and OR behind Potential's stars (which add XP).
const atAge32ByPlayer = computed(() => atAgeValues(POTENTIAL_AGE, atAge32History.value));

const atAgeFor = (player: HockeyPlayer): AtAgeValue | null =>
  atAgeByPlayer.value.get(player.id) ?? null;
const atAge32For = (player: HockeyPlayer): AtAgeValue | null =>
  atAge32ByPlayer.value.get(player.id) ?? null;

const atAgeMissingTitle = (player: HockeyPlayer, targetAge = PROJECTION_AGE) => {
  if (exactAgeOf(player) >= targetAge) {
    const nearHistory = targetAge === PROJECTION_AGE ? atAgeHistory.value : atAge32History.value;
    return nearHistory === null
      ? "History could not be loaded"
      : `No stored day with skills within ${AT_AGE_TOLERANCE_DAYS} days of when the player turned ${targetAge}`;
  }
  return "No pace to project from";
};

onMounted(async () => {
  await store.loadFromCache();
  await loadHistoryMeta();
});

const filteredPlayers = computed(() =>
  store.cachedPlayers.filter((player: HockeyPlayer) => {
    try {
      // Team filter
      if (!matchesTeam(player, effectiveTeam.value)) return false;

      // Freshness filter
      if (selectedFreshness.value !== "All") {
        const daysSinceUpdate = Math.floor(
          (new Date().getTime() - player.updatedAt.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (selectedFreshness.value === "Fresh" && daysSinceUpdate > 1)
          return false;
        if (
          selectedFreshness.value === "Stale" &&
          (daysSinceUpdate <= 1 || daysSinceUpdate > 7)
        )
          return false;
        if (selectedFreshness.value === "Very Stale" && daysSinceUpdate <= 7)
          return false;
      }

      // Completeness filter
      if (selectedCompleteness.value !== "All") {
        const completeness = calculateCompleteness(player);
        if (completeness !== selectedCompleteness.value.toLowerCase())
          return false;
      }

      // Position filter
      if (selectedPosition.value !== "All") {
        const bestPos = player.getBestPosition();
        if (bestPos.name !== selectedPosition.value) return false;
      }

      // History filter
      if (selectedHistory.value !== "All") {
        const hasHistory = (historySummaries.value.get(player.id)?.days ?? 0) > 0;
        if (selectedHistory.value === "Has history" && !hasHistory) return false;
        if (selectedHistory.value === "No history" && hasHistory) return false;
      }

      return true;
    } catch (error) {
      console.error("[PlayerReport] Error filtering player:", player.id, player.name, error);
      return false; // Exclude players that cause errors
    }
  })
);

const getFreshnessCount = (freshness: string) => {
  if (freshness === "All") return store.cachedPlayers.length;
  return store.cachedPlayers.filter((p) => {
    const days = Math.floor(
      (new Date().getTime() - p.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (freshness === "Fresh") return days <= 1;
    if (freshness === "Stale") return days > 1 && days <= 7;
    if (freshness === "Very Stale") return days > 7;
    return false;
  }).length;
};

const getCompletenessCount = (completeness: string) => {
  if (completeness === "All") return store.cachedPlayers.length;
  return store.cachedPlayers.filter(
    (p) => calculateCompleteness(p) === completeness.toLowerCase()
  ).length;
};

const getHistoryCount = (option: string) => {
  if (option === "All") return store.cachedPlayers.length;
  return store.cachedPlayers.filter((p) => {
    const hasHistory = (historySummaries.value.get(p.id)?.days ?? 0) > 0;
    return option === "Has history" ? hasHistory : !hasHistory;
  }).length;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// The headline figure is the size of the record data, not the disk footprint -
// say so, rather than letting the smaller number read as the whole story.
const historyStatsTitle = computed(() => {
  const stats = historyStats.value;
  if (!stats) return "";
  const base =
    "Measured JSON size of all stored entries. Actual disk use is higher - " +
    "IndexedDB adds primary keys, the by_playerId index and row overhead.";
  return stats.originBytes
    ? `${base} Browser reports ${formatBytes(stats.originBytes)} for the extension origin.`
    : base;
});

const historyFor = (player: HockeyPlayer): SkillHistorySummary | undefined =>
  historySummaries.value.get(player.id);

const historyTitle = (player: HockeyPlayer) => {
  const summary = historyFor(player);
  if (!summary) return "No skill history stored";
  const gaps =
    summary.missingDays > 0 ? `${summary.missingDays} days missing` : "no gaps";
  return `${summary.days} days, ${summary.firstDate} - ${summary.lastDate}, ${gaps}`;
};

/** How long a success message stays before tidying itself away. */
const NOTICE_TIMEOUT_MS = 6000;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Starts the auto-clear countdown, if this notice is one that should expire.
 *
 * Only successes expire. Errors and the "N malformed entries were skipped"
 * warning stay until the next action - they're the ones worth reading twice,
 * and a warning that vanished on a timer could be missed entirely.
 */
const scheduleNoticeClear = () => {
  clearTimeout(noticeTimer);

  if (!backupNotice.value || backupError.value) return;

  // Never while the clear dialog is open. The "backup saved" line is the whole
  // reason the user is about to feel safe pressing a destructive button, so it
  // must not disappear from under them mid-decision. The watcher below restarts
  // the countdown once the dialog closes.
  if (confirmingClear.value) return;

  noticeTimer = setTimeout(() => {
    backupNotice.value = "";
  }, NOTICE_TIMEOUT_MS);
};

const setNotice = (message: string, isError = false) => {
  backupNotice.value = message;
  backupError.value = isError;
  scheduleNoticeClear();
};

watch(confirmingClear, (open) => {
  if (!open) scheduleNoticeClear();
});

// A pending callback would otherwise write to a torn-down component.
onBeforeUnmount(() => clearTimeout(noticeTimer));

const exportBackup = async () => {
  backupBusy.value = "export";
  setNotice("");
  try {
    const backup = await createBackup();
    if (!backup) {
      setNotice("Could not read the skill history - no file was saved.", true);
      return;
    }
    downloadBackup(backup);
    setNotice(
      `Saved ${backup.skillHistory.length.toLocaleString()} history records and ` +
        `${Object.keys(backup.playerCaches).length} team cache(s).`
    );
  } catch (error) {
    console.error("[PlayerReport] Export failed:", error);
    setNotice("Export failed - see the console for details.", true);
  } finally {
    backupBusy.value = "";
  }
};

const chooseImportFile = () => {
  setNotice("");
  fileInput.value?.click();
};

const onFileChosen = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  // Reset immediately, so re-picking the same file still fires a change event.
  input.value = "";
  if (!file) return;

  backupBusy.value = "import";
  try {
    const parsed = parseBackup(await file.text());
    importMode.value = "merge";
    pendingImport.value = parsed;
  } catch (error) {
    setNotice(error instanceof Error ? error.message : "Could not read that file.", true);
  } finally {
    backupBusy.value = "";
  }
};

const performImport = async () => {
  const parsed = pendingImport.value;
  if (!parsed) return;

  pendingImport.value = null;
  backupBusy.value = "import";
  try {
    const result = await restoreBackup(parsed.backup, importMode.value);
    await store.loadFromCache();
    await loadHistoryMeta();

    const skipped = parsed.skippedEntries
      ? ` ${parsed.skippedEntries.toLocaleString()} malformed entries were skipped.`
      : "";
    setNotice(
      `Imported ${result.entriesWritten.toLocaleString()} history records and ` +
        `${result.playersWritten} players.${skipped}`,
      parsed.skippedEntries > 0
    );
  } catch (error) {
    console.error("[PlayerReport] Import failed:", error);
    setNotice(error instanceof Error ? error.message : "Import failed.", true);
    // The store may be partly changed, so show what is actually there now.
    await store.loadFromCache();
    await loadHistoryMeta();
  } finally {
    backupBusy.value = "";
  }
};

const requestClear = () => {
  setNotice("");
  confirmingClear.value = true;
};

/** Backup from inside the clear dialog. Deliberately leaves it open. */
const backupBeforeClear = async () => {
  await exportBackup();
};

const performClear = async () => {
  // Never clear while a backup is still being read. Both hit the same store, and
  // IndexedDB would just serialise them - if the clear landed first, the export
  // in flight would come back empty, save a plausible-looking file with no
  // history in it, and report success. That is the exact outcome this whole
  // feature exists to prevent. The dialog also disables the button, so this is
  // the belt to that braces.
  if (backupBusy.value !== "") return;

  confirmingClear.value = false;
  const cleared = await store.clearAllStoredData();
  // Ask the worker what is actually there rather than assuming the clear
  // succeeded. Blanking the header unconditionally would show an empty store
  // on a failed clear - and the data would reappear on the user's next reload.
  await loadHistoryMeta();

  // clearAllStoredData() returns null rather than 0 when the history clear
  // failed. Without this the distinction only ever reached the console, and a
  // half-completed wipe looked exactly like a successful one.
  if (cleared === null) {
    setNotice("Player caches were cleared, but the skill history could not be.", true);
  } else {
    setNotice(
      `Cleared ${cleared.toLocaleString()} history records and all cached players.`
    );
  }
};

const openPlayerProfile = (playerId: string) => {
  const url = buildPlayerProfileUrl(store.sport, store.lang, store.playerPage, playerId);
  window.open(url, "_blank");
};

// Projected peak (rating with XP at POTENTIAL_AGE) per player, for the
// Potential stars. Computed once per load, like the pace.
const potentialByPlayer = computed(() => {
  const values = new Map<string, Potential | null>();
  store.cachedPlayers.forEach((player: HockeyPlayer) => {
    const best = player.getBestPosition();
    values.set(
      player.id,
      projectPotential(player.skills, player.experience, exactAgeOf(player), paceFor(player), {
        rating: best.ratingWithBonus,
        ratingWithXp: best.ratingWithXp,
      })
    );
  });
  return values;
});

const potentialFor = (player: HockeyPlayer): Potential | null =>
  potentialByPlayer.value.get(player.id) ?? null;

/** "gold tier, 22%" - the same tiering RatingStars draws. */
const tierLabel = (value: number) => {
  const { low, medium, high } = ratingSettings;
  const [tier, from, to] =
    value < low ? ["silver", 0, low] : value < medium ? ["gold", low, medium] : ["diamond", medium, high];
  const fill = Math.min(100, Math.round(((value - from) / (to - from)) * 100));
  return `${tier} tier, ${fill}%`;
};

const skillStarsTitle = (player: HockeyPlayer) => {
  const value = player.getBestPosition().ratingWithXp;
  return `${value} (skill with XP) - ${tierLabel(value)}`;
};

const potentialTitle = (player: HockeyPlayer) => {
  const potential = potentialFor(player);
  if (!potential) return "No pace to project from";
  if (potential.kind === "current") {
    return (
      `${potential.ratingWithXp} now - at or past peak age (${POTENTIAL_AGE}), so this is ` +
      `the current skill with XP. ${tierLabel(potential.ratingWithXp)}`
    );
  }
  return (
    `~${potential.ratingWithXp} at ${POTENTIAL_AGE}: rating ~${potential.rating} (no XP) + XP ` +
    `~${Math.round(potential.xp)}. ${tierLabel(potential.ratingWithXp)}. Same model as Skill ` +
    `@${PROJECTION_AGE}, extended to ${POTENTIAL_AGE}; XP grows at the squad's typical rate ` +
    "from here (past playing time elsewhere doesn't carry over)."
  );
};

// Heatmap ramps and shading live in @/components/heatmap, shared with the
// basketball report.
type SkillKey = keyof NonNullable<HockeyPlayer["skills"]>;

// Each skill column shades against its own max in the current view, so a
// player's profile reads as a pattern: a defender's defence dark, offence light.
const columnMax = computed(() => {
  const max = (read: (p: HockeyPlayer) => number | null | undefined) =>
    Math.max(0, ...filteredPlayers.value.map((p) => read(p) ?? 0));
  // Min..max over the players that have a value, for the growth columns.
  const range = (read: (p: HockeyPlayer) => number | null | undefined) => {
    const values = filteredPlayers.value
      .map(read)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    return values.length > 0
      ? { min: Math.min(...values), max: Math.max(...values) }
      : { min: 0, max: 0 };
  };
  const skill = (key: SkillKey) => max((p) => p.skills?.[key]);
  return {
    goalie: skill("goalie"),
    defence: skill("defence"),
    offence: skill("offence"),
    shooting: skill("shooting"),
    passing: skill("passing"),
    technical: skill("technical"),
    aggression: skill("aggression"),
    pace: range((p) => paceFor(p)?.pace),
    skillAtAge: range((p) => atAgeFor(p)?.skill),
    orAtAge: range((p) => atAgeFor(p)?.or),
    skillAt32: range((p) => atAge32For(p)?.skill),
    orAt32: range((p) => atAge32For(p)?.or),
  };
});

const skillColumn = (header: string, key: SkillKey): Column => ({
  header,
  key: `skills.${key}`,
  group: "Skills",
  align: "right",
  sortable: true,
  sortValue: (p: HockeyPlayer) => p.skills?.[key] ?? 0,
  slot: key,
  cellStyle: (p: HockeyPlayer) =>
    heatStyle(p.skills?.[key], 0, columnMax.value[key], SKILL_RAMP),
});

// Grouped so the 26 columns read in blocks, with Growth beside Position -
// the two sets most often compared.
const tableColumns = computed<Column[]>(() => [
  // Player
  { header: "Name", key: "name", slot: "name", sortable: true, cellClass: "name-cell", group: "Player" },
  { header: "Age", key: "age", sortable: true, group: "Player", align: "right" },
  { header: "CL", key: "careerLongitivity", sortable: true, group: "Player", align: "right" }, // Career Longevity
  { header: "OR", key: "overallRating", sortable: true, group: "Player", align: "right" },
  { header: "Exp", key: "experience", sortable: true, group: "Player", align: "right" },

  // Skills
  skillColumn("Goa", "goalie"),
  skillColumn("Def", "defence"),
  skillColumn("Off", "offence"),
  skillColumn("Sho", "shooting"),
  skillColumn("Pas", "passing"),
  skillColumn("Tec", "technical"),
  skillColumn("Agg", "aggression"),

  // Position
  {
    header: "Best Pos",
    key: "position",
    slot: "position",
    sortable: true,
    group: "Position",
    align: "center",
    sortValue: (p: HockeyPlayer) => p.getBestPosition().name,
  },
  {
    header: "Pos Skill",
    key: "skill",
    slot: "skill",
    sortable: true,
    group: "Position",
    align: "right",
    sortValue: (p: HockeyPlayer) => p.getBestPosition().ratingWithXp,
  },
  {
    header: "Skill ★",
    key: "skillStars",
    slot: "skillStars",
    sortable: true,
    group: "Position",
    align: "center",
    sortValue: (p: HockeyPlayer) => p.getBestPosition().ratingWithXp,
  },
  {
    header: "Pos TQ", // Position Training Quality
    key: "positionTQ",
    slot: "positionTQ",
    sortable: true,
    group: "Position",
    align: "right",
    sortValue: (p: HockeyPlayer) => p.getBestPositionTrainingQuality().totalTrainingQuality,
  },

  // Growth
  {
    header: "Pace",
    key: "pace",
    slot: "pace",
    sortable: true,
    group: "Growth",
    align: "right",
    // Null sorts last, so players with no measurable pace stay out of the way.
    sortValue: (p: HockeyPlayer) => paceFor(p)?.pace ?? null,
    cellStyle: (p: HockeyPlayer) =>
      heatStyle(paceFor(p)?.pace, columnMax.value.pace.min, columnMax.value.pace.max, GROWTH_RAMP),
  },
  // Recorded and projected values sort together on purpose - see AtAgeValue.
  {
    header: `Skill @${PROJECTION_AGE}`,
    key: "skillAtAge",
    slot: "skillAtAge",
    sortable: true,
    group: "Growth",
    align: "right",
    sortValue: (p: HockeyPlayer) => atAgeFor(p)?.skill ?? null,
    cellStyle: (p: HockeyPlayer) =>
      heatStyle(
        atAgeFor(p)?.skill,
        columnMax.value.skillAtAge.min,
        columnMax.value.skillAtAge.max,
        GROWTH_RAMP
      ),
  },
  {
    header: `OR @${PROJECTION_AGE}`,
    key: "orAtAge",
    slot: "orAtAge",
    sortable: true,
    group: "Growth",
    align: "right",
    sortValue: (p: HockeyPlayer) => atAgeFor(p)?.or ?? null,
    cellStyle: (p: HockeyPlayer) =>
      heatStyle(atAgeFor(p)?.or, columnMax.value.orAtAge.min, columnMax.value.orAtAge.max, GROWTH_RAMP),
  },
  // The skill and OR behind Potential's stars, before XP.
  {
    header: `Skill @${POTENTIAL_AGE}`,
    key: "skillAt32",
    slot: "skillAt32",
    sortable: true,
    group: "Growth",
    align: "right",
    sortValue: (p: HockeyPlayer) => atAge32For(p)?.skill ?? null,
    cellStyle: (p: HockeyPlayer) =>
      heatStyle(atAge32For(p)?.skill, columnMax.value.skillAt32.min, columnMax.value.skillAt32.max, GROWTH_RAMP),
  },
  {
    header: `OR @${POTENTIAL_AGE}`,
    key: "orAt32",
    slot: "orAt32",
    sortable: true,
    group: "Growth",
    align: "right",
    sortValue: (p: HockeyPlayer) => atAge32For(p)?.or ?? null,
    cellStyle: (p: HockeyPlayer) =>
      heatStyle(atAge32For(p)?.or, columnMax.value.orAt32.min, columnMax.value.orAt32.max, GROWTH_RAMP),
  },
  {
    header: "Potential ★",
    key: "potential",
    slot: "potential",
    sortable: true,
    group: "Growth",
    align: "center",
    sortValue: (p: HockeyPlayer) => potentialFor(p)?.ratingWithXp ?? null,
  },

  // Info
  { header: "Side", key: "preferredSide", sortable: true, group: "Info", align: "center" },
  { header: "Injury", key: "injuryDays", sortable: true, group: "Info", align: "right" },
  {
    header: "Team",
    key: "teamName",
    slot: "team",
    sortable: true,
    group: "Info",
    sortValue: (p: HockeyPlayer) => p.teamName ?? p.teamId ?? "",
  },

  // Data
  { header: "Scouted", key: "scoutingStatus", slot: "scouted", sortable: true, group: "Data", align: "center" },
  {
    header: "Completeness",
    key: "completeness",
    slot: "completeness",
    sortable: true,
    group: "Data",
    sortValue: (p: HockeyPlayer) => {
      const c = calculateCompleteness(p);
      return c === "full" ? 3 : c === "partial" ? 2 : 1;
    },
  },
  {
    header: "Freshness",
    key: "freshness",
    slot: "freshness",
    sortable: true,
    group: "Data",
    sortValue: (p: HockeyPlayer) =>
      Math.floor(
        (new Date().getTime() - p.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      ),
  },
  {
    header: "History",
    key: "history",
    slot: "history",
    sortable: true,
    group: "Data",
    // Day count, so sorting groups the players still needing a gather run.
    sortValue: (p: HockeyPlayer) => historySummaries.value.get(p.id)?.days ?? 0,
  },
  {
    header: "Last Updated",
    key: "updatedAt",
    slot: "updatedAt",
    sortable: true,
    group: "Data",
    sortValue: (p: HockeyPlayer) => p.updatedAt.getTime(),
  },
]);

const formatDate = (date: Date) => {
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
};

const getCompletenessBadgeClass = (player: HockeyPlayer) => {
  const c = calculateCompleteness(player);
  return {
    "badge-full": c === "full",
    "badge-partial": c === "partial",
    "badge-minimal": c === "minimal",
  };
};

const getCompletenessBadgeText = (player: HockeyPlayer) => {
  const c = calculateCompleteness(player);
  return c.charAt(0).toUpperCase() + c.slice(1);
};
</script>

<template>
  <div class="full-player-table">
    <div class="header-section white_box">
      <h2>Full Player Table - Cached Data</h2>
      <div class="stats">
        <span>Total Cached: {{ store.cachedPlayers.length }} players</span>
        <span
          v-if="historyStats && historyStats.records > 0"
          class="history-stats"
          :title="historyStatsTitle"
        >
          Skill history: {{ historyStats.records.toLocaleString() }} records ·
          {{ historyStats.players }} players ·
          {{ formatBytes(historyStats.jsonBytes) }}
        </span>
        <button
          class="backup-btn"
          :disabled="backupBusy !== ''"
          @click="exportBackup"
        >
          {{ backupBusy === "export" ? "Exporting…" : "Export backup" }}
        </button>
        <button
          class="backup-btn"
          :disabled="backupBusy !== ''"
          @click="chooseImportFile"
        >
          {{ backupBusy === "import" ? "Importing…" : "Import backup" }}
        </button>
        <button @click="requestClear" class="clear-btn">Clear All Data</button>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          class="file-input"
          @change="onFileChosen"
        />
      </div>
      <p v-if="backupNotice" class="backup-notice" :class="{ error: backupError }">
        {{ backupNotice }}
      </p>
    </div>

    <div class="view-tabs white_box">
      <button
        :class="{ active: activeTab === 'table' }"
        @click="activeTab = 'table'"
      >
        Table
      </button>
      <button
        :class="{ active: activeTab === 'graph' }"
        @click="activeTab = 'graph'"
      >
        Growth Comparison
      </button>
    </div>

    <div class="filters white_box">
      <div class="filter-group">
        <label>Team:</label>
        <button
          v-for="team in TEAM_OPTIONS"
          :key="team"
          @click="selectedTeam = team"
          :class="{ active: effectiveTeam === team }"
          :disabled="team !== 'All' && !teamKnown"
          :title="team === 'My team' ? myTeamTitle : undefined"
        >
          {{ team }} ({{ getTeamCount(team) }})
        </button>
      </div>

      <div class="filter-group">
        <label>Freshness:</label>
        <button
          v-for="freshness in ['All', 'Fresh', 'Stale', 'Very Stale']"
          :key="freshness"
          @click="selectedFreshness = freshness"
          :class="{ active: selectedFreshness === freshness }"
        >
          {{ freshness }} ({{ getFreshnessCount(freshness) }})
        </button>
      </div>

      <div class="filter-group">
        <label>Completeness:</label>
        <button
          v-for="completeness in ['All', 'Full', 'Partial', 'Minimal']"
          :key="completeness"
          @click="selectedCompleteness = completeness"
          :class="{ active: selectedCompleteness === completeness }"
        >
          {{ completeness }} ({{ getCompletenessCount(completeness) }})
        </button>
      </div>

      <div class="filter-group">
        <label>History:</label>
        <button
          v-for="option in ['All', 'Has history', 'No history']"
          :key="option"
          @click="selectedHistory = option"
          :class="{ active: selectedHistory === option }"
        >
          {{ option }} ({{ getHistoryCount(option) }})
        </button>
      </div>

      <div class="filter-group">
        <label>Position:</label>
        <button
          v-for="pos in ['All', 'D', 'W', 'C', 'G']"
          :key="pos"
          @click="selectedPosition = pos"
          :class="{ active: selectedPosition === pos }"
        >
          {{ pos }}
        </button>
      </div>
    </div>

    <template v-if="activeTab === 'table'">
    <div v-if="filteredPlayers.length === 0" class="empty-state white_box">
      <p v-if="store.cachedPlayers.length === 0">
        No cached player data found. Visit player pages to start building your
        cache.
      </p>
      <p v-else>No players match the selected filters.</p>
    </div>

    <p v-else-if="filteredPlayers.length > 0" class="heat-legend">
      Shading: darker = higher within the column.
      <span class="heat-legend__swatches" aria-hidden="true">
        <span v-for="c in SKILL_RAMP" :key="c" :style="{ background: c }"></span>
      </span>
      Skills
      <span class="heat-legend__swatches" aria-hidden="true">
        <span v-for="c in GROWTH_RAMP" :key="c" :style="{ background: c }"></span>
      </span>
      Growth (lowest to highest in view)
    </p>

    <div v-if="filteredPlayers.length > 0" class="table-container report-table white_box">
      <SortableTable
        :items="filteredPlayers"
        :columns="tableColumns"
        :defaultSort="{ key: 'updatedAt', dir: 'desc' }"
        sticky
      >
        <template #name="{ item }">
          <a @click.prevent="openPlayerProfile(item.id)" class="player-link">
            {{ item.name }}
          </a>
        </template>

        <template #position="{ item }">
          <span class="position-chip">{{ item.getBestPosition().name }}</span>
        </template>

        <!-- Individual Skill Slots -->
        <template #goalie="{ item }">
          {{ item.skills?.goalie ?? '-' }}
        </template>

        <template #defence="{ item }">
          {{ item.skills?.defence ?? '-' }}
        </template>

        <template #offence="{ item }">
          {{ item.skills?.offence ?? '-' }}
        </template>

        <template #shooting="{ item }">
          {{ item.skills?.shooting ?? '-' }}
        </template>

        <template #passing="{ item }">
          {{ item.skills?.passing ?? '-' }}
        </template>

        <template #technical="{ item }">
          {{ item.skills?.technical ?? '-' }}
        </template>

        <template #aggression="{ item }">
          {{ item.skills?.aggression ?? '-' }}
        </template>

        <!-- Position Skill -->
        <template #skill="{ item }">
          {{ item.getBestPosition().ratingWithXp }}
        </template>

        <!-- Position Training Quality -->
        <template #positionTQ="{ item }">
          {{ item.getBestPositionTrainingQuality().totalTrainingQuality }}
        </template>

        <!-- Team Name -->
        <template #team="{ item }">
          {{ item.teamName ?? item.teamId ?? '-' }}
        </template>

        <template #scouted="{ item }">
          <span :class="['scouted-badge', item.scoutingStatus?.toLowerCase() ?? 'unscouted']">
            {{
              item.scoutingStatus === "SCOUTED"
                ? "✓"
                : item.scoutingStatus === "IN_PROGRESS"
                ? "◐"
                : "✗"
            }}
          </span>
        </template>

        <template #completeness="{ item }">
          <span
            class="completeness-badge"
            :class="getCompletenessBadgeClass(item)"
          >
            {{ getCompletenessBadgeText(item) }}
          </span>
        </template>

        <template #freshness="{ item }">
          <PlayerDataFreshness
            :updatedAt="item.updatedAt"
            :seasonDay="item.seasonDay"
            :currentSeasonDay="currentSeasonDay"
          />
        </template>

        <template #history="{ item }">
          <span v-if="historyFor(item)" class="history-cell" :title="historyTitle(item)">
            <span class="history-days">{{ historyFor(item)!.days }}d</span>
            <span class="history-since">{{ historyFor(item)!.firstDate.slice(0, 7) }}</span>
          </span>
          <span v-else class="history-none" :title="historyTitle(item)">-</span>
        </template>

        <template #skillStars="{ item }">
          <span :title="skillStarsTitle(item)">
            <RatingStars :skill="item.getBestPosition().ratingWithXp" :settings="ratingSettings" />
          </span>
        </template>

        <template #potential="{ item }">
          <span v-if="potentialFor(item)" :title="potentialTitle(item)">
            <RatingStars :skill="potentialFor(item)!.ratingWithXp" :settings="ratingSettings" />
          </span>
          <span v-else class="history-none" :title="potentialTitle(item)">-</span>
        </template>

        <template #pace="{ item }">
          <span
            v-if="paceFor(item)?.provisional && paceFor(item)?.pace != null"
            class="projected"
            :title="paceTitle(item)"
          >
            ~{{ Math.round(paceFor(item)!.pace! * 100) }}%
          </span>
          <span v-else-if="paceFor(item)?.pace != null" :title="paceTitle(item)">
            {{ Math.round(paceFor(item)!.pace! * 100) }}%
          </span>
          <span v-else class="history-none" :title="paceTitle(item)">-</span>
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

        <template #updatedAt="{ item }">
          {{ formatDate(item.updatedAt) }}
        </template>
      </SortableTable>
    </div>
    </template>

    <PlayerGrowthComparisonChart
      v-else-if="activeTab === 'graph'"
      :players="filteredPlayers"
      :current-season-day="currentSeasonDay"
    />

    <ConfirmDialog
      :open="confirmingClear"
      title="Clear all stored data?"
      confirm-label="Clear everything"
      danger
      :confirm-disabled="backupBusy !== ''"
      @cancel="confirmingClear = false"
      @confirm="performClear"
    >
      <p>This deletes both stores and cannot be undone:</p>
      <ul>
        <li>
          <strong>{{ store.cachedPlayers.length }}</strong> cached players
        </li>
        <li v-if="historyStats && historyStats.records > 0">
          <strong>{{ historyStats.records.toLocaleString() }}</strong> skill-history
          records across
          <strong>{{ historyStats.players }}</strong> players
        </li>
        <li v-else>No skill history is stored.</li>
      </ul>
      <p>
        Cached players rebuild themselves as you browse. Skill history does not -
        rebuilding it means re-running a Gather history walk on every player.
      </p>
      <!-- Stays open afterwards: download, check the file, then decide. -->
      <button
        class="backup-btn dialog-backup"
        :disabled="backupBusy !== ''"
        @click="backupBeforeClear"
      >
        {{ backupBusy === "export" ? "Saving backup…" : "Download backup first" }}
      </button>
      <p v-if="backupNotice" class="backup-notice" :class="{ error: backupError }">
        {{ backupNotice }}
      </p>
    </ConfirmDialog>

    <ConfirmDialog
      :open="pendingImport !== null"
      title="Import backup"
      confirm-label="Import"
      :danger="importMode === 'replace'"
      @cancel="pendingImport = null"
      @confirm="performImport"
    >
      <template v-if="pendingImport">
        <p>
          This file holds
          <strong>{{ pendingImport.backup.skillHistory.length.toLocaleString() }}</strong>
          history records and
          <strong>{{ Object.keys(pendingImport.backup.playerCaches).length }}</strong>
          team cache(s), exported
          {{
            pendingImport.backup.exportedAt
              ? new Date(pendingImport.backup.exportedAt).toLocaleString()
              : "at an unknown time"
          }}
          from extension {{ pendingImport.backup.extensionVersion }}.
        </p>

        <p v-if="pendingImport.skippedEntries > 0" class="backup-notice error">
          {{ pendingImport.skippedEntries.toLocaleString() }} malformed entries will be
          skipped.
        </p>

        <label class="import-mode">
          <input type="radio" value="merge" v-model="importMode" />
          <span>
            <strong>Merge</strong> - keep what's stored and add the file to it. Nothing is
            lost.
          </span>
        </label>
        <label class="import-mode">
          <input type="radio" value="replace" v-model="importMode" />
          <span>
            <strong>Replace</strong> - make the stores match the file exactly, discarding
            anything captured since the export.
          </span>
        </label>
      </template>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
/* The page frame (.full-player-table, .white_box) is in @/components/reportTable.css. */

.header-section {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
}

/*
 * The notice is a third flex item in this row, so without a full-width basis
 * space-between pushes it hard right and it overflows the card. Child
 * combinator on purpose: the same class is reused inside the clear dialog,
 * where it's an ordinary block and must not be given flex sizing.
 */
.header-section > .backup-notice {
  flex-basis: 100%;
}

.header-section h2 {
  margin: 0;
  color: #333;
}

.stats {
  display: flex;
  /* Two stat spans and three buttons - reflow rather than spill once the
     window is narrower than a wide desktop. */
  flex-wrap: wrap;
  gap: 15px;
  align-items: center;
}

.clear-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.clear-btn:hover {
  background: #c82333;
}

.backup-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.backup-btn:hover:not(:disabled) {
  background: #5a6268;
}

.backup-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

/* Driven by the Import button; never shown, but must stay focusable-free. */
.file-input {
  display: none;
}

.backup-notice {
  margin: 8px 0 0;
  font-size: 13px;
  color: #2b7a3d;
}

.backup-notice.error {
  color: #b3383f;
}

.dialog-backup {
  margin-top: 4px;
}

.import-mode {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
}

.import-mode input {
  margin-top: 3px;
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
  transition: all 0.2s;
}

.view-tabs button:hover {
  background: #f8f9fa;
}

.view-tabs button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

/* Filters, table, chips, legend, links and history cells: see
   @/components/reportTable.css, shared with the basketball report. */

.badge-full {
  background: #d4edda;
  color: #155724;
}

.badge-partial {
  background: #cfe2ff;
  color: #084298;
}

.badge-minimal {
  background: #e2e3e5;
  color: #383d41;
}

/* Make skill columns more compact */
.table td {
  white-space: nowrap;
}


</style>
