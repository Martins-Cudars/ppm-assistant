<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { usePlayerStore } from "@/stores/playerStore";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { getCurrentSeasonDay } from "@/utils";
import { calculateCompleteness } from "@/storage/serialization";
import PlayerDataFreshness from "./PlayerDataFreshness.vue";
import SortableTable, { type Column } from "@/components/SortableTable.vue";
import RatingStars from "@/components/RatingStars.vue";

const store = usePlayerStore();
const selectedFreshness = ref("All");
const selectedCompleteness = ref("All");
const selectedPosition = ref("All");

// Current season day comes from the store (loaded from cache)
const currentSeasonDay = computed(() => store.currentSeasonDay);

onMounted(async () => {
  await store.loadFromCache();
});

const filteredPlayers = computed(() => {
  console.log(
    "[PlayerReport] Total cached players:",
    store.cachedPlayers.length
  );
  console.log("[PlayerReport] Sample player:", store.cachedPlayers[0]);

  const filtered = store.cachedPlayers.filter((player: HockeyPlayer) => {
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

      return true;
    } catch (error) {
      console.error("[PlayerReport] Error filtering player:", player.id, player.name, error);
      return false; // Exclude players that cause errors
    }
  });

  console.log("[PlayerReport] Filtered players:", filtered.length);
  console.log("[PlayerReport] Position breakdown:",
    filtered.map(p => p.getBestPosition().name).reduce((acc, pos) => {
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  );
  return filtered;
});

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

const clearCache = () => {
  if (
    confirm(
      "Are you sure you want to clear all cached player data? This cannot be undone."
    )
  ) {
    store.clearCachedPlayers();
  }
};

const openPlayerProfile = (playerId: string) => {
  window.location.href = `/hockey/player.html?data=${playerId}`;
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
    header: "Team ID",
    key: "teamId",
    slot: "teamId",
    sortable: true,
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
        <button @click="clearCache" class="clear-btn">Clear Cache</button>
      </div>
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

        <!-- Team ID -->
        <template #teamId="{ item }">
          {{ item.teamId ?? '-' }}
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

        <template #updatedAt="{ item }">
          {{ formatDate(item.updatedAt) }}
        </template>
      </SortableTable>
    </div>

    <div class="debug-section white_box" style="margin-top: 20px">
      <h3>Debug Information</h3>
      <div style="margin-bottom: 10px">
        <strong>Filtered Players Count:</strong> {{ filteredPlayers.length }}
      </div>
      <div style="margin-bottom: 10px">
        <strong>Sample Player (first):</strong>
        <pre><code>{{ JSON.stringify(filteredPlayers[0], null, 2) }}</code></pre>
      </div>
      <div style="margin-bottom: 10px">
        <strong>Table Columns:</strong>
        <pre><code>{{ JSON.stringify(tableColumns, null, 2) }}</code></pre>
      </div>
      <div>
        <strong>All Players (raw):</strong>
        <pre
          style="max-height: 400px; overflow-y: auto"
        ><code>{{ JSON.stringify(filteredPlayers, null, 2) }}</code></pre>
      </div>
    </div>
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
  justify-content: space-between;
  align-items: center;
}

.header-section h2 {
  margin: 0;
  color: #333;
}

.stats {
  display: flex;
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
