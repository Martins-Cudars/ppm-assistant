<template>
  <div class="player-sidebar">
    <BasketballPlayerAbility :player="player" />
    <BasketballPlayerPotential :player="player" />
    <BasketballSquadRank :player="player" />
  </div>
</template>

<script setup lang="ts">
import { BasketballPlayer } from "@/sports/basketball/classes/BasketballPlayer";
import BasketballPlayerAbility from "./BasketballPlayerAbility.vue";
import BasketballPlayerPotential from "./BasketballPlayerPotential.vue";
import BasketballSquadRank from "./BasketballSquadRank.vue";

defineProps<{
  player: BasketballPlayer;
}>();
</script>

<style scoped>
/* Same spacing rule as the hockey sidebar: the sidebar owns the gaps, the
   cards' own margins (global margin-top plus scoped margin-bottom) are zeroed,
   so the cards sit as tight as the game's own blocks. */
.player-sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.player-sidebar > .player-profile {
  margin: 0;
}
</style>
