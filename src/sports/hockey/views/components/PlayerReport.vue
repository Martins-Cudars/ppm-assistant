<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { usePlayerStore } from "@/stores/playerStore";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { calculateCompleteness } from "@/storage/serialization";
import { getSkillHistoryStats, getSkillHistorySummaries } from "@/storage/skillHistoryDb";
import { SkillHistoryStats, SkillHistorySummary } from "@/types/SkillHistory";
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

const store = usePlayerStore();
const activeTab = ref<"table" | "graph">("table");
const selectedFreshness = ref("All");
const selectedCompleteness = ref("All");
const selectedPosition = ref("All");
const selectedHistory = ref("All");

// Skill-history coverage per player, keyed by player id. Populated after the
// cache loads; a player missing from the map simply has nothing stored.
const historySummaries = ref<Map<string, SkillHistorySummary>>(new Map());

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
  // Independent of each other, so don't serialise them.
  const [summaries, stats] = await Promise.all([
    getSkillHistorySummaries(),
    getSkillHistoryStats(),
  ]);
  historySummaries.value = summaries;
  historyStats.value = stats;
};

onMounted(async () => {
  await store.loadFromCache();
  await loadHistoryMeta();
});

const filteredPlayers = computed(() =>
  store.cachedPlayers.filter((player: HockeyPlayer) => {
    try {
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

const tableColumns = computed<Column[]>(() => [
  // Basic Info
  {
    header: "Name",
    key: "name",
    slot: "name",
    sortable: true,
    cellClass: "name-cell",
  },
  {
    header: "Age",
    key: "age",
    sortable: true,
  },
  {
    header: "CL", // Career Longevity
    key: "careerLongitivity",
    sortable: true,
  },
  {
    header: "OR",
    key: "overallRating",
    sortable: true,
  },
  {
    header: "Exp",
    key: "experience",
    sortable: true,
  },

  // Skills (7 columns)
  {
    header: "Goa",
    key: "skills.goalie",
    sortable: true,
    sortValue: (p: HockeyPlayer) => p.skills?.goalie ?? 0,
    slot: "goalie",
  },
  {
    header: "Def",
    key: "skills.defence",
    sortable: true,
    sortValue: (p: HockeyPlayer) => p.skills?.defence ?? 0,
    slot: "defence",
  },
  {
    header: "Off",
    key: "skills.offence",
    sortable: true,
    sortValue: (p: HockeyPlayer) => p.skills?.offence ?? 0,
    slot: "offence",
  },
  {
    header: "Sho",
    key: "skills.shooting",
    sortable: true,
    sortValue: (p: HockeyPlayer) => p.skills?.shooting ?? 0,
    slot: "shooting",
  },
  {
    header: "Pas",
    key: "skills.passing",
    sortable: true,
    sortValue: (p: HockeyPlayer) => p.skills?.passing ?? 0,
    slot: "passing",
  },
  {
    header: "Tec",
    key: "skills.technical",
    sortable: true,
    sortValue: (p: HockeyPlayer) => p.skills?.technical ?? 0,
    slot: "technical",
  },
  {
    header: "Agg",
    key: "skills.aggression",
    sortable: true,
    sortValue: (p: HockeyPlayer) => p.skills?.aggression ?? 0,
    slot: "aggression",
  },

  // Position and Rating
  {
    header: "Best Pos",
    key: "position",
    slot: "position",
    sortable: true,
    sortValue: (p: HockeyPlayer) => p.getBestPosition().name,
  },
  {
    header: "Pos Skill",
    key: "skill",
    slot: "skill",
    sortable: true,
    sortValue: (p: HockeyPlayer) => p.getBestPosition().ratingWithXp,
  },
  {
    header: "Pos TQ", // Position Training Quality
    key: "positionTQ",
    slot: "positionTQ",
    sortable: true,
    sortValue: (p: HockeyPlayer) => p.getBestPositionTrainingQuality().totalTrainingQuality,
  },

  // Additional Info
  {
    header: "Side",
    key: "preferredSide",
    sortable: true,
  },
  {
    header: "Injury",
    key: "injuryDays",
    sortable: true,
  },
  {
    header: "Team",
    key: "teamName",
    slot: "team",
    sortable: true,
    sortValue: (p: HockeyPlayer) => p.teamName ?? p.teamId ?? "",
  },

  // Status
  {
    header: "Scouted",
    key: "scoutingStatus",
    slot: "scouted",
    sortable: true,
  },
  {
    header: "Completeness",
    key: "completeness",
    slot: "completeness",
    sortable: true,
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
    // Day count, so sorting groups the players still needing a gather run.
    sortValue: (p: HockeyPlayer) => historySummaries.value.get(p.id)?.days ?? 0,
  },
  {
    header: "Last Updated",
    key: "updatedAt",
    slot: "updatedAt",
    sortable: true,
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

    <div v-else class="table-container white_box">
      <SortableTable
        :items="filteredPlayers"
        :columns="tableColumns"
        :defaultSort="{ key: 'updatedAt', dir: 'desc' }"
      >
        <template #name="{ item }">
          <a @click.prevent="openPlayerProfile(item.id)" class="player-link">
            {{ item.name }}
          </a>
        </template>

        <template #position="{ item }">
          {{ item.getBestPosition().name }}
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
.full-player-table {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.white_box {
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 15px;
}

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

.filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  font-weight: 600;
  min-width: 100px;
}

.filter-group button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.filter-group button:hover {
  background: #f8f9fa;
}

.filter-group button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 16px;
}

.table-container {
  overflow-x: auto;
}

.player-link {
  color: #007bff;
  text-decoration: none;
  cursor: pointer;
}

.player-link:hover {
  text-decoration: underline;
}

.name-cell {
  font-weight: 500;
}

.scouted-badge {
  display: inline-block;
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  border-radius: 50%;
  font-weight: bold;
}

.scouted-badge.scouted {
  background: #d4edda;
  color: #155724;
}

.scouted-badge.in_progress {
  background: #fff3cd;
  color: #856404;
}

.scouted-badge.unscouted {
  background: #f8d7da;
  color: #721c24;
}

.completeness-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.history-stats {
  color: #666;
  font-size: 13px;
  cursor: help;
}

.history-cell {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  white-space: nowrap;
}

.history-since {
  color: #666;
  font-size: 11px;
}

.history-none {
  color: #999;
}

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

/* Reduce padding and center skill columns */
.table :deep(td:nth-child(n+6):nth-child(-n+12)) {
  padding: 2px 6px;
  text-align: center;
  font-size: 13px;
}
</style>
