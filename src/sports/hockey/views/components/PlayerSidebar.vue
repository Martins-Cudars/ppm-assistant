<template>
  <div class="player-sidebar">
    <PlayerAbility :player="player" />
    <PlayerPotential :player="player" />
    <PlayerSquadRank :player="player" />
  </div>
</template>

<script setup lang="ts">
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import PlayerAbility from "./PlayerAbility.vue";
import PlayerPotential from "./PlayerPotential.vue";
import PlayerSquadRank from "./PlayerSquadRank.vue";

defineProps<{
  player: HockeyPlayer;
}>();
</script>

<style scoped>
/*
 * The sidebar owns the spacing between its cards. Each card otherwise brings
 * its own: a global margin-top (styles.css) plus a scoped margin-bottom, which
 * stacked with the gap to 32px - far looser than the game's own blocks above.
 */
.player-sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

/* Compiles to .player-sidebar > .player-profile[data-v-sidebar] - one class more
   specific than each card's own scoped margin, so it wins regardless of order. */
.player-sidebar > .player-profile {
  margin: 0;
}
</style>
