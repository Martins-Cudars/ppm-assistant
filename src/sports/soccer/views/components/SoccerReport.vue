<script setup lang="ts">
/**
 * The soccer Player Report - phase 1: what's been captured, so gathering can
 * be checked. The full table (skills, positions, growth) and the comparison
 * chart come once the soccer history has been researched (see
 * docs/skill-history.md, Soccer).
 */
import { computed, onMounted, ref } from "vue";
import { StoredSoccerPlayer, deserializeSoccerPlayer } from "@/sports/soccer/capture";
import { SoccerPlayer } from "@/sports/soccer/classes/SoccerPlayer";
import { readSportTeamCache } from "@/storage/playerCache";
import { getSkillHistoryStats, getSkillHistorySummaries } from "@/storage/skillHistoryDb";
import { SkillHistoryStats, SkillHistorySummary } from "@/types/SkillHistory";
import SortableTable, { type Column } from "@/components/SortableTable.vue";
import "@/components/reportTable.css";

const loading = ref(true);
const players = ref<SoccerPlayer[]>([]);
const squad = ref<string[] | null>(null);
const summaries = ref<Map<string, SkillHistorySummary>>(new Map());
const historyStats = ref<SkillHistoryStats | null>(null);

onMounted(async () => {
  const [cache, historySummaries, stats] = await Promise.all([
    readSportTeamCache<StoredSoccerPlayer>("soccer"),
    getSkillHistorySummaries("soccer"),
    getSkillHistoryStats("soccer"),
  ]);
  if (cache) {
    players.value = Object.values(cache.players).map(deserializeSoccerPlayer);
    squad.value = cache.squad?.playerIds ?? null;
  }
  summaries.value = historySummaries;
  historyStats.value = stats;
  loading.value = false;
});

// The squad overview's roster when there is one; everyone cached otherwise.
const shown = computed(() =>
  squad.value ? players.value.filter((p) => squad.value!.includes(p.id)) : players.value
);

const columns: Column[] = [
  { header: "Name", key: "name", sortable: true, cellClass: "name-cell" },
  { header: "Age", key: "age", sortable: true, align: "right" },
  { header: "OR", key: "overallRating", sortable: true, align: "right" },
  {
    header: "Best Pos",
    key: "position",
    slot: "position",
    sortable: true,
    align: "center",
    sortValue: (p: SoccerPlayer) => p.getBestPosition().name,
  },
  {
    header: "Pos Skill",
    key: "skill",
    slot: "skill",
    sortable: true,
    align: "right",
    sortValue: (p: SoccerPlayer) => p.getBestPosition().ratingWithXp,
  },
  {
    header: "History",
    key: "history",
    slot: "history",
    sortable: true,
    sortValue: (p: SoccerPlayer) => summaries.value.get(p.id)?.days ?? 0,
  },
];
</script>

<template>
  <div class="full-player-table soccer-report">
    <div class="soccer-header white_box">
      <h2>Soccer players - cached data</h2>
      <span>Squad: {{ shown.length }} (cached {{ players.length }})</span>
      <span v-if="historyStats">
        History: {{ historyStats.records.toLocaleString() }} records ·
        {{ historyStats.players }} players
      </span>
      <span class="soccer-header__note">
        Full report (skills, positions, growth) comes after the soccer research.
      </span>
    </div>

    <div v-if="loading" class="empty-state white_box">Loading soccer players…</div>
    <div v-else-if="players.length === 0" class="empty-state white_box">
      No soccer players cached yet. Open your soccer squad overview in the game - each visit
      stores the whole squad and today's history. Each player's Training progress page has a
      "Gather history" button for their past.
    </div>
    <div v-else class="table-container report-table white_box">
      <SortableTable :items="shown" :columns="columns" :defaultSort="{ key: 'history', dir: 'asc' }" sticky>
        <template #position="{ item }">
          <span class="position-chip">{{ item.getBestPosition().name }}</span>
        </template>
        <template #skill="{ item }">{{ item.getBestPosition().ratingWithXp }}</template>
        <template #history="{ item }">
          <span v-if="summaries.get(item.id)" class="history-cell">
            <span>{{ summaries.get(item.id)!.days }}d</span>
            <span class="history-since">{{ summaries.get(item.id)!.firstDate }}</span>
          </span>
          <span v-else class="history-none">-</span>
        </template>
      </SortableTable>
    </div>
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
</style>
