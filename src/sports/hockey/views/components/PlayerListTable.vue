<script setup lang="ts">
import { ref, computed } from "vue";
import { usePlayerStore } from "@/stores/playerStore";
import { positionSettings } from "@/sports/hockey/settings";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";

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
          <td class="th1">Vārds</td>
          <td class="th2">Poz</td>
          <td class="th1">Vecums</td>
          <td class="th2">IzS</td>
          <td class="th1">VidV</td>
          <td class="th2">KI</td>
          <td class="th1">Vār</td>
          <td class="th2">Aizs</td>
          <td class="th1">Uzb</td>
          <td class="th2">Met</td>
          <td class="th1">Piesp</td>
          <td class="th2">Teh</td>
          <td class="th1">Agr</td>
          <td class="th2">Pie</td>
          <td class="th1">KR</td>
          <td class="th2">VP</td>
          <!-- New Columns -->
          <td class="th1">Best Pos</td>
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
          <td class="name" :class="index % 2 === 0 ? 'tr0td1' : 'tr1td1'">
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
          <td :class="index % 2 === 0 ? 'tr0td2' : 'tr1td2'">
            {{ player.teamPosition }}
          </td>
          <td :class="index % 2 === 0 ? 'tr0td1' : 'tr1td1'">
            {{ player.age }}
          </td>
          <td :class="index % 2 === 0 ? 'tr0td2' : 'tr1td2'">
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
          <td :class="index % 2 === 0 ? 'tr0td1' : 'tr1td1'">
            {{ player.averageTrainingRatio }}
          </td>
          <td :class="index % 2 === 0 ? 'tr0td2' : 'tr1td2'">
            {{ player.careerLongitivity }}/6
          </td>
          <td :class="index % 2 === 0 ? 'tr0td1' : 'tr1td1'">
            {{ player.skills?.goalie }}
          </td>
          <td :class="index % 2 === 0 ? 'tr0td2' : 'tr1td2'">
            {{ player.skills?.defence }}
          </td>
          <td :class="index % 2 === 0 ? 'tr0td1' : 'tr1td1'">
            {{ player.skills?.offence }}
          </td>
          <td :class="index % 2 === 0 ? 'tr0td2' : 'tr1td2'">
            {{ player.skills?.shooting }}
          </td>
          <td :class="index % 2 === 0 ? 'tr0td1' : 'tr1td1'">
            {{ player.skills?.passing }}
          </td>
          <td :class="index % 2 === 0 ? 'tr0td2' : 'tr1td2'">
            {{ player.skills?.technical }}
          </td>
          <td :class="index % 2 === 0 ? 'tr0td1' : 'tr1td1'">
            {{ player.skills?.aggression }}
          </td>
          <td :class="index % 2 === 0 ? 'tr0td2' : 'tr1td2'">
            {{ player.experience }}
          </td>
          <td :class="index % 2 === 0 ? 'tr0td1' : 'tr1td1'">
            {{ player.overallRating }}
          </td>
          <td :class="index % 2 === 0 ? 'tr0td2' : 'tr1td2'">
            {{ player.preferredSide }}
          </td>

          <!-- New Columns -->
          <td :class="index % 2 === 0 ? 'tr0td1' : 'tr1td1'">
            {{ getBestPosition(player).name }}
          </td>
          <td :class="index % 2 === 0 ? 'tr0td2' : 'tr1td2'">
            {{ getBestPosition(player).ratingWithXp }}
          </td>
          <td :class="index % 2 === 0 ? 'tr0td1' : 'tr1td1'">
            <!-- Placeholder for Rating -->
            {{ getBestPosition(player).ratingWithXp }}
          </td>
          <td :class="index % 2 === 0 ? 'tr0td2' : 'tr1td2'">
            <!-- Placeholder for Relative Skill -->
            {{ getBestPosition(player).ratingWithXp }}
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
