<script setup lang="ts">
/**
 * The soccer Player Report: every cached soccer player in one grouped,
 * heatmapped table, plus the growth comparison chart. Same look as hockey's
 * and basketball's (shared SortableTable, heatmap, reportTable.css and
 * GrowthComparisonChart), soccer's own columns.
 *
 * Growth columns (pace, @25, potential) come in phase 4 - see
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
import { soccerHistoryPoints, topPlayerSkillCurve } from "@/sports/soccer/historyChart";
import { readSportTeamCache } from "@/storage/playerCache";
import {
  exportSkillHistory,
  getSkillHistoryStats,
  getSkillHistorySummaries,
} from "@/storage/skillHistoryDb";
import { getUserSettings } from "@/storage/userSettings";
import { SkillHistoryEntry, SkillHistoryStats, SkillHistorySummary } from "@/types/SkillHistory";
import { buildPlayerProfileUrl } from "@/utils/parsers";
import SortableTable, { type Column } from "@/components/SortableTable.vue";
import RatingStars from "@/components/RatingStars.vue";
import GrowthComparisonChart, {
  type GrowthReference,
  type GrowthSeries,
} from "@/components/GrowthComparisonChart.vue";
import { SKILL_RAMP, heatStyle } from "@/components/heatmap";
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

onMounted(async () => {
  const [cache, historySummaries, stats, settings, allHistory] = await Promise.all([
    readSportTeamCache<StoredSoccerPlayer>("soccer"),
    getSkillHistorySummaries("soccer"),
    getSkillHistoryStats("soccer"),
    getUserSettings(),
    exportSkillHistory("soccer"),
  ]);
  if (cache) {
    players.value = Object.values(cache.players).map(deserializeSoccerPlayer);
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
    const grouped = new Map<string, SkillHistoryEntry<SoccerSkills>[]>();
    (allHistory as unknown as SkillHistoryEntry<SoccerSkills>[]).forEach((entry) => {
      const list = grouped.get(entry.playerId);
      if (list) list.push(entry);
      else grouped.set(entry.playerId, [entry]);
    });
    history.value = grouped;
  }
  loading.value = false;
});

const idOf = (player: SoccerPlayer) => normalizePlayerId(player.id) ?? player.id;
const exactAgeOf = (player: SoccerPlayer) =>
  player.age + seasonDay.value / soccerPlayerProfile.daysPerSeason;

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

// The grey line: the top-player table's rating by age. It has no OR column,
// so the OR view has no reference.
const topPlayerReference: GrowthReference = {
  label: "Top player (no XP)",
  skill: topPlayerSkillCurve,
  or: [],
};
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
      :reference="topPlayerReference"
      :loading="history === null"
    />

    <template v-else>
      <p class="heat-legend">
        Shading: darker = higher within the column.
        <span class="heat-legend__swatches" aria-hidden="true">
          <span v-for="c in SKILL_RAMP" :key="c" :style="{ background: c }"></span>
        </span>
        Skills and positions. Growth columns (pace, @25, potential) come in the next phase.
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
