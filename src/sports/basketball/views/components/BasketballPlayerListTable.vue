<script setup lang="ts">
import { computed, ref } from "vue";
import SortableTable, { type Column } from "@/components/SortableTable.vue";
import RatingStars from "@/components/RatingStars.vue";
import BasketballPlayerListChart from "./BasketballPlayerListChart.vue";
import { positionSettings, ratingSettings } from "@/sports/basketball/settings";
import type { BasketballPlayerListItem } from "../types";

const props = defineProps<{
  items: BasketballPlayerListItem[];
  headers: string[];
}>();

const selectedPosition = ref("All");
const minAge = ref(15);
const maxAge = ref(50);

const filteredItems = computed(() =>
  props.items.filter(({ player }) => {
    const matchesPosition =
      selectedPosition.value === "All" ||
      player.getBestPosition().name === selectedPosition.value;
    const matchesAge = player.age >= minAge.value && player.age <= maxAge.value;
    return matchesPosition && matchesAge;
  })
);

const ageFilteredPlayers = computed(() =>
  props.items
    .filter(({ player }) => player.age >= minAge.value && player.age <= maxAge.value)
    .map(({ player }) => player)
);

const getCountForPosition = (positionName: string) =>
  props.items.filter(({ player }) => {
    const matchesPosition =
      positionName === "All" || player.getBestPosition().name === positionName;
    const matchesAge = player.age >= minAge.value && player.age <= maxAge.value;
    return matchesPosition && matchesAge;
  }).length;

const setPosition = (positionName: string) => {
  selectedPosition.value = positionName;
};

const tableColumns = computed<Column[]>(() => {
  const cols: Column[] = [
    {
      header: props.headers[0] || "Name",
      key: "player.name",
      slot: "name",
      sortable: true,
      align: "left",
      headerClass: "th1",
      cellClass: "name-cell",
    },
    {
      header: props.headers[1] || "Age",
      key: "player.age",
      sortable: true,
      headerClass: "th1",
    },
    {
      header: props.headers[2] || "VidV",
      key: "player.averageTrainingRatio",
      sortable: true,
      headerClass: "th2",
    },
    {
      header: props.headers[3] || "CL",
      key: "player.careerLongitivity",
      slot: "careerLongitivity",
      sortable: true,
      headerClass: "th1",
    },
    {
      header: props.headers[4] || "Sho",
      key: "player.skills.shooting",
      sortable: true,
      headerClass: "th2",
    },
    {
      header: props.headers[5] || "Blo",
      key: "player.skills.blocking",
      sortable: true,
      headerClass: "th1",
    },
    {
      header: props.headers[6] || "Pas",
      key: "player.skills.passing",
      sortable: true,
      headerClass: "th2",
    },
    {
      header: props.headers[7] || "Tec",
      key: "player.skills.technical",
      sortable: true,
      headerClass: "th1",
    },
    {
      header: props.headers[8] || "Spe",
      key: "player.skills.speed",
      sortable: true,
      headerClass: "th2",
    },
    {
      header: props.headers[9] || "Agg",
      key: "player.skills.aggression",
      sortable: true,
      headerClass: "th1",
    },
    {
      header: props.headers[10] || "Jum",
      key: "player.skills.jumping",
      sortable: true,
      headerClass: "th2",
    },
    {
      header: props.headers[11] || "Exp",
      key: "player.experience",
      sortable: true,
      headerClass: "th1",
    },
    {
      header: props.headers[12] || "OR",
      key: "player.overallRating",
      sortable: true,
      headerClass: "th2",
    },
    {
      header: props.headers[13] || "Height",
      key: "player.height",
      sortable: true,
      headerClass: "th1",
    },
    {
      header: "Pos",
      key: "position",
      slot: "position",
      sortable: true,
      sortValue: (item: BasketballPlayerListItem) => item.player.getBestPosition().name,
      headerClass: "th1",
    },
    {
      header: "Skill",
      key: "skill",
      slot: "skill",
      sortable: true,
      sortValue: (item: BasketballPlayerListItem) =>
        item.player.getBestPosition().ratingWithXp,
      headerClass: "th2",
    },
    {
      header: "Rating",
      key: "rating",
      slot: "rating",
      sortable: true,
      sortValue: (item: BasketballPlayerListItem) =>
        item.player.getBestPosition().ratingWithXp,
      headerClass: "th1",
    },
  ];

  return cols;
});
</script>

<template>
  <div class="basketball-player-list">
    <div class="position-filter white_box">
      <div class="position-buttons">
        <button
          @click="setPosition('All')"
          :class="{ active: selectedPosition === 'All' }"
        >
          All ({{ getCountForPosition("All") }})
        </button>
        <button
          v-for="pos in positionSettings"
          :key="pos.name"
          @click="setPosition(pos.name)"
          :class="{ active: selectedPosition === pos.name }"
        >
          {{ pos.name }} ({{ getCountForPosition(pos.name) }})
        </button>
      </div>

      <div class="age-filter">
        <label>
          Age:
          <input v-model.number="minAge" type="number" min="15" max="50" class="age-input" />
          -
          <input v-model.number="maxAge" type="number" min="15" max="50" class="age-input" />
        </label>
      </div>
    </div>

    <SortableTable
      :columns="tableColumns"
      :items="filteredItems"
      :default-sort="{ key: 'player.overallRating', dir: 'desc' }"
    >
      <template #name="{ item }">
        <span class="name-content">
          <a
            v-if="item.countryFlag?.src"
            :href="item.countryFlag.href"
            class="flag-link"
          >
            <img
              :src="item.countryFlag.src"
              :alt="item.countryFlag.alt"
              :title="item.countryFlag.title"
              height="16"
              class="country-flag"
            />
          </a>
          <a v-if="item.profileUrl" :href="item.profileUrl" class="link_name">
            {{ item.player.name }}
          </a>
          <span v-else class="player-name">{{ item.player.name }}</span>
          <img
            v-if="item.injuryIndicator?.src"
            :src="item.injuryIndicator.src"
            :alt="item.injuryIndicator.alt"
            :title="item.injuryIndicator.title"
            width="16"
            height="16"
            class="injury-indicator"
          />
        </span>
      </template>

      <template #careerLongitivity="{ item }">
        {{ item.player.careerLongitivity }}/6
      </template>

      <template #position="{ item }">
        {{ item.player.getBestPosition().name }}
      </template>

      <template #skill="{ item }">
        {{ item.player.getBestPosition().ratingWithXp }}
      </template>

      <template #rating="{ item }">
        <RatingStars
          :skill="item.player.getBestPosition().ratingWithXp"
          :settings="ratingSettings"
        />
      </template>
    </SortableTable>

    <BasketballPlayerListChart :players="ageFilteredPlayers" />
  </div>
</template>

<style scoped>
.position-filter {
  margin-bottom: 10px;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.position-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.position-buttons button {
  cursor: pointer;
}

button.active {
  font-weight: bold;
}

.age-filter {
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.age-input {
  width: 50px;
  margin: 0 5px;
}

:deep(td.name-cell) {
  text-align: left !important;
  padding-left: 12px !important;
}

:deep(td.name-cell .name-content) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

:deep(td.name-cell *) {
  text-align: left;
}

:deep(td.name-cell .link_name),
:deep(td.name-cell .player-name),
:deep(td.name-cell .flag-link),
:deep(td.name-cell .country-flag),
:deep(td.name-cell .injury-indicator) {
  vertical-align: middle;
}

.flag-link {
  display: inline-flex;
  align-items: center;
}

.country-flag {
  vertical-align: middle;
}

.name-cell a {
  font-weight: 400;
}

.injury-indicator {
  vertical-align: middle;
}
</style>
