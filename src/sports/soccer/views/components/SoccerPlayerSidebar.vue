<template>
  <div class="player-sidebar">
    <SoccerPlayerAbility :player="player" />
    <SoccerPlayerPotential :player="player" />
    <SoccerPlayerExport :player="player" />
  </div>
</template>

<script setup lang="ts">
import { SoccerPlayer } from "@/sports/soccer/classes/SoccerPlayer";
import SoccerPlayerAbility from "./SoccerPlayerAbility.vue";
import SoccerPlayerExport from "./SoccerPlayerExport.vue";
import SoccerPlayerPotential from "./SoccerPlayerPotential.vue";

defineProps<{
  player: SoccerPlayer;
}>();
</script>

<style scoped>
.player-sidebar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
