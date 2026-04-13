<template>
  <div class="player-sidebar">
    <BasketballPlayerAbility :player="player" />
    <BasketballPlayerPotential :player="player" />
  </div>
</template>

<script setup lang="ts">
import { BasketballPlayer } from "@/sports/basketball/classes/BasketballPlayer";
import BasketballPlayerAbility from "./BasketballPlayerAbility.vue";
import BasketballPlayerPotential from "./BasketballPlayerPotential.vue";

defineProps<{
  player: BasketballPlayer;
}>();
</script>

<style scoped>
.player-sidebar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
