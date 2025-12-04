<template>
  <div class="player-sidebar">
    <PlayerAbility :player="player" />
    <PlayerPotential :player="player" />
  </div>
</template>

<script setup lang="ts">
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import PlayerAbility from "./PlayerAbility.vue";
import PlayerPotential from "./PlayerPotential.vue";

defineProps<{
  player: HockeyPlayer;
}>();
</script>

<style scoped>
.player-sidebar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
