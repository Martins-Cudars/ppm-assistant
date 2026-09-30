<script setup lang="ts">
/**
 * The basketball Player Report: every cached basketball player in one grouped,
 * heatmapped table. Same look as hockey's (shared SortableTable, heatmap and
 * reportTable.css), basketball's own columns.
 *
 * No growth columns yet: basketball has no history page, so history starts
 * with capture, and pace/@25/potential wait until there's enough of it to
 * measure basketball's rules (see docs/skill-history.md, Basketball roadmap).
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
import routes from "@/sports/basketball/routes";
import { getLocalizedPageForLang } from "@/sports/routeDispatch";
import { readSportTeamCache } from "@/storage/playerCache";
import { getSkillHistoryStats, getSkillHistorySummaries } from "@/storage/skillHistoryDb";
import { getUserSettings } from "@/storage/userSettings";
import { SkillHistoryStats, SkillHistorySummary } from "@/types/SkillHistory";
import { buildPlayerProfileUrl } from "@/utils/parsers";
import SortableTable, { type Column } from "@/components/SortableTable.vue";
import RatingStars from "@/components/RatingStars.vue";
import { SKILL_RAMP, heatStyle } from "@/components/heatmap";
import "@/components/reportTable.css";

const loading = ref(true);
const players = ref<BasketballPlayer[]>([]);
const teamId = ref("unknown");
const squad = ref<{ playerIds: string[]; updatedAt: string } | null>(null);
const summaries = ref<Map<string, SkillHistorySummary>>(new Map());
const historyStats = ref<SkillHistoryStats | null>(null);
const lang = ref("en");

onMounted(async () => {
  const [cache, historySummaries, stats, settings] = await Promise.all([
    readSportTeamCache<StoredBasketballPlayer>("basketball"),
    getSkillHistorySummaries("basketball"),
    getSkillHistoryStats("basketball"),
    getUserSettings(),
  ]);
  if (cache) {
    players.value = Object.values(cache.players).map(deserializeBasketballPlayer);
    teamId.value = cache.teamId;
    squad.value = cache.squad ?? null;
  }
  summaries.value = historySummaries;
  historyStats.value = stats;
  lang.value = settings.lang;
  loading.value = false;
});

const idOf = (player: BasketballPlayer) => normalizePlayerId(player.id) ?? player.id;

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
      <span class="bb-header__note">
        Backup and Clear are on the Hockey tab - they cover every sport.
      </span>
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

    <template v-else>
      <p class="heat-legend">
        Shading: darker = higher within the column.
        <span class="heat-legend__swatches" aria-hidden="true">
          <span v-for="c in SKILL_RAMP" :key="c" :style="{ background: c }"></span>
        </span>
        Skills and position ratings. Growth columns come once enough basketball history is
        captured.
      </p>

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

.bb-header__note {
  margin-left: auto;
  font-size: 12px;
  color: #888;
}
</style>
