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

    <table id="table-1" class="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Age</th>
          <th>Pos</th>
          <th>Skill</th>
          <th>Rating</th>
          <th>Relative</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="player in filteredPlayers" :key="player.id || player.name">
          <td>{{ player.name }}</td>
          <td>{{ player.age }}</td>
          <td>{{ getBestPosition(player).name }}</td>
          <td>{{ getBestPosition(player).ratingWithXp }}</td>
          <td>
            <!-- Placeholder for Rating -->
            {{ getBestPosition(player).ratingWithXp }}
          </td>
          <td>
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
