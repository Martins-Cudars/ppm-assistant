<script setup lang="ts">
import { ref, computed } from "vue";
import { usePlayerStore } from "@/stores/playerStore";
import { positionSettings, ratingSettings } from "@/sports/hockey/settings";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";

import RatingStars from "@/components/RatingStars.vue";
import RelativeSkill from "@/components/RelativeSkill.vue";

import SortableTable, { type Column } from "@/components/SortableTable.vue";

const store = usePlayerStore();
const selectedPosition = ref("All");
const minAge = ref(15);
const maxAge = ref(50);

const filteredPlayers = computed(() => {
  return store.players.filter((player: HockeyPlayer) => {
    const matchesPosition =
      selectedPosition.value === "All" ||
      player.getBestPosition().name === selectedPosition.value;
    const matchesAge = player.age >= minAge.value && player.age <= maxAge.value;
    return matchesPosition && matchesAge;
  });
});

const getCountForPosition = (posName: string) => {
  return store.players.filter((p) => p.getBestPosition().name === posName)
    .length;
};

const setPosition = (pos: string) => {
  selectedPosition.value = pos;
};

const getBestPosition = (player: HockeyPlayer) => {
  return player.getBestPosition();
};

const getAdjustedSkill = (player: HockeyPlayer) => {
  const bestPos = player.getBestPosition();
  return bestPos.ratingWithXp;
};

const tableColumns = computed<Column[]>(() => {
  const headers = store.tableHeaders;
  const mapping: Partial<Column>[] = [
    {
      key: "name",
      slot: "name",
      sortable: true,
      headerClass: "th1",
      cellClass: "name",
    },
    { key: "teamPosition", sortable: true, headerClass: "th2" },
    { key: "age", sortable: true, headerClass: "th1" },
    { key: "isScouted", slot: "scouted", sortable: true, headerClass: "th2" },
    { key: "averageTrainingRatio", sortable: true, headerClass: "th1" },
    {
      key: "careerLongitivity",
      slot: "cl",
      sortable: true,
      headerClass: "th2",
    },
    { key: "skills.goalie", sortable: true, headerClass: "th1" },
    { key: "skills.defence", sortable: true, headerClass: "th2" },
    { key: "skills.offence", sortable: true, headerClass: "th1" },
    { key: "skills.shooting", sortable: true, headerClass: "th2" },
    { key: "skills.passing", sortable: true, headerClass: "th1" },
    { key: "skills.technical", sortable: true, headerClass: "th2" },
    { key: "skills.aggression", sortable: true, headerClass: "th1" },
    { key: "experience", sortable: true, headerClass: "th2" },
    { key: "overallRating", sortable: true, headerClass: "th1" },
    { key: "preferredSide", sortable: true, headerClass: "th2" },
  ];

  const cols = mapping.map((col, index) => ({
    ...col,
    header: headers[index] || "",
  })) as Column[];

  cols.push(
    {
      header: "Pos",
      key: "position",
      slot: "position",
      sortable: true,
      sortValue: (p: HockeyPlayer) => p.getBestPosition().name,
      headerClass: "th1",
    },
    {
      header: "Skill",
      key: "skill",
      slot: "skill",
      sortable: true,
      sortValue: (p: HockeyPlayer) => p.getBestPosition().ratingWithXp,
      headerClass: "th2",
    },
    {
      header: "Rating",
      key: "rating",
      slot: "rating",
      sortable: true,
      sortValue: (p: HockeyPlayer) => getAdjustedSkill(p),
      headerClass: "th1",
    },
    {
      header: "Relative",
      key: "relative",
      slot: "relative",
      sortable: true,
      sortValue: (p: HockeyPlayer) => {
        const skill = getAdjustedSkill(p);
        const max = p.getMaxSkillForAge();
        return max ? skill / max : 0;
      },
      headerClass: "th2",
    }
  );

  return cols;
});
</script>

<template>
  <div class="player-list-vue">
    <div class="position-filter white_box">
      <div class="position-buttons">
        <button
          @click="setPosition('All')"
          :class="{ active: selectedPosition === 'All' }"
        >
          All ({{ store.players.length }})
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
          <input
            type="number"
            v-model.number="minAge"
            min="15"
            max="50"
            class="age-input"
          />
          -
          <input
            type="number"
            v-model.number="maxAge"
            min="15"
            max="50"
            class="age-input"
          />
        </label>
      </div>
    </div>

    <SortableTable
      :columns="tableColumns"
      :items="filteredPlayers"
      :default-sort="{ key: 'overallRating', dir: 'desc' }"
    >
      <template #name="{ item }">
        <a v-if="item.countryImage" :href="item.countryLink" class="flag_link">
          <img
            :src="item.countryImage"
            height="16"
            style="vertical-align: middle; margin-right: 5px"
            align="absMiddle"
          />
        </a>
        <a
          :href="`https://hockey.powerplaymanager.com/lv/speletajs.html?data=${item.id}`"
          class="link_name"
        >
          {{ item.name }}
        </a>
        <img
          v-if="item.injuryDays > 0"
          src="https://www.powerplaymanager.com/hockey/_images/account/icons/day_to_day.png"
          :title="`Dienas līdz atlabšanai: ${item.injuryDays}`"
          :alt="`Dienas līdz atlabšanai: ${item.injuryDays}`"
          width="16"
          height="16"
          style="vertical-align: middle; margin-left: 5px"
        />
      </template>

      <template #scouted="{ item }">
        <img
          v-if="item.isScouted"
          src="https://www.powerplaymanager.com/hockey/_images/account/icons/scouted_yes.png"
          title="Izpētīts"
          alt="Izpētīts"
          width="16"
          height="14"
          border="0"
        />
      </template>

      <template #cl="{ item }"> {{ item.careerLongitivity }}/6 </template>

      <template #position="{ item }">
        {{ getBestPosition(item).name }}
      </template>

      <template #skill="{ item }">
        {{ getBestPosition(item).ratingWithXp }}
      </template>

      <template #rating="{ item }">
        <RatingStars
          :skill="getAdjustedSkill(item)"
          :settings="ratingSettings"
        />
      </template>

      <template #relative="{ item }">
        <RelativeSkill
          :skill="getAdjustedSkill(item)"
          :maxSkillForAge="item.getMaxSkillForAge()"
        />
      </template>
    </SortableTable>
  </div>
</template>

<style scoped>
.position-filter {
  margin-bottom: 10px;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.position-buttons button {
  margin-right: 5px;
  cursor: pointer;
}

button.active {
  font-weight: bold;
}

.age-filter {
  display: flex;
  align-items: center;
}

.age-input {
  width: 50px;
  margin: 0 5px;
}
</style>
