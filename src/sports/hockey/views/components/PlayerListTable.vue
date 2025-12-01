<script setup lang="ts">
import { ref, computed } from "vue";
import { usePlayerStore } from "@/stores/playerStore";
import { positionSettings, ratingSettings } from "@/sports/hockey/settings";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";

import RatingStars from "@/components/RatingStars.vue";
import RelativeSkill from "@/components/RelativeSkill.vue";

const store = usePlayerStore();
const selectedPosition = ref("All");

const filteredPlayers = computed(() => {
  if (selectedPosition.value === "All") {
    return store.players;
  }
  return store.players.filter((player: HockeyPlayer) => {
    return player.getBestPosition().name === selectedPosition.value;
  });
});

const setPosition = (pos: string) => {
  selectedPosition.value = pos;
};

const getBestPosition = (player: HockeyPlayer) => {
  return player.getBestPosition();
};

const getAdjustedSkill = (player: HockeyPlayer) => {
  const bestPos = player.getBestPosition();
  const setting = positionSettings.find((p) => p.name === bestPos.name);
  return bestPos.ratingWithXp * (setting?.positionRatio || 1);
};

const getRowClass = (index: number, type: "td1" | "td2") => {
  const rowType = index % 2 === 0 ? "tr0" : "tr1";
  return `${rowType}${type}`;
};
</script>

<template>
  <div class="player-list-vue">
    <div class="position-filter white_box">
      <button @click="setPosition('All')">
        All ({{ store.players.length }})
      </button>
      <button
        v-for="pos in positionSettings"
        :key="pos.name"
        @click="setPosition(pos.name)"
      >
        {{ pos.name }}
      </button>
    </div>

    <table cellspacing="0" cellpadding="2" class="table" id="table-1">
      <thead>
        <tr>
          <td
            v-for="(header, index) in store.tableHeaders"
            :key="index"
            :class="index % 2 === 0 ? 'th1' : 'th2'"
          >
            {{ header }}
          </td>
          <!-- New Columns -->
          <td class="th1">Pos</td>
          <td class="th2">Skill</td>
          <td class="th1">Rating</td>
          <td class="th2">Relative</td>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(player, index) in filteredPlayers"
          :key="player.id || player.name"
          :class="index % 2 === 0 ? 'tr0' : 'tr1'"
        >
          <td class="name" :class="getRowClass(index, 'td1')">
            <a v-if="player.countryImage" href="#" class="flag_link">
              <img
                :src="player.countryImage"
                height="16"
                style="vertical-align: middle"
                align="absMiddle"
              />
            </a>
            <a
              :href="`https://hockey.powerplaymanager.com/lv/speletajs.html?data=${player.id}`"
              class="link_name"
            >
              {{ player.name }}
            </a>
          </td>
          <td :class="getRowClass(index, 'td2')">
            {{ player.teamPosition }}
          </td>
          <td :class="getRowClass(index, 'td1')">
            {{ player.age }}
          </td>
          <td :class="getRowClass(index, 'td2')">
            <img
              v-if="player.isScouted"
              src="https://www.powerplaymanager.com/hockey/_images/account/icons/scouted_yes.png"
              title="Izpētīts"
              alt="Izpētīts"
              width="16"
              height="14"
              border="0"
            />
          </td>
          <td :class="getRowClass(index, 'td1')">
            {{ player.averageTrainingRatio }}
          </td>
          <td :class="getRowClass(index, 'td2')">
            {{ player.careerLongitivity }}/6
          </td>
          <td :class="getRowClass(index, 'td1')">
            {{ player.skills?.goalie }}
          </td>
          <td :class="getRowClass(index, 'td2')">
            {{ player.skills?.defence }}
          </td>
          <td :class="getRowClass(index, 'td1')">
            {{ player.skills?.offence }}
          </td>
          <td :class="getRowClass(index, 'td2')">
            {{ player.skills?.shooting }}
          </td>
          <td :class="getRowClass(index, 'td1')">
            {{ player.skills?.passing }}
          </td>
          <td :class="getRowClass(index, 'td2')">
            {{ player.skills?.technical }}
          </td>
          <td :class="getRowClass(index, 'td1')">
            {{ player.skills?.aggression }}
          </td>
          <td :class="getRowClass(index, 'td2')">
            {{ player.experience }}
          </td>
          <td :class="getRowClass(index, 'td1')">
            {{ player.overallRating }}
          </td>
          <td :class="getRowClass(index, 'td2')">
            {{ player.preferredSide }}
          </td>

          <!-- New Columns -->
          <td :class="getRowClass(index, 'td1')">
            {{ getBestPosition(player).name }}
          </td>
          <td :class="getRowClass(index, 'td2')">
            {{ getBestPosition(player).ratingWithXp }}
          </td>
          <td :class="getRowClass(index, 'td1')">
            <RatingStars
              :skill="getAdjustedSkill(player)"
              :maxSkill="ratingSettings.maxSkill"
            />
          </td>
          <td :class="getRowClass(index, 'td2')">
            <RelativeSkill
              :skill="getAdjustedSkill(player)"
              :maxSkillForAge="player.getMaxSkillForAge()"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.position-filter {
  margin-bottom: 10px;
  padding: 10px;
}
.position-filter button {
  margin-right: 5px;
  cursor: pointer;
}
</style>
