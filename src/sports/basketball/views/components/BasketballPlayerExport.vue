<template>
  <PlayerProfileExport :to-json="exportJson" :to-csv="exportCsv" />
</template>

<script setup lang="ts">
import PlayerProfileExport from "@/components/PlayerProfileExport.vue";
import { BasketballPlayer } from "@/sports/basketball/classes/BasketballPlayer";
import {
  basketballPlayerProfileToCsv,
  basketballPlayerProfileToJson,
} from "@/sports/basketball/utils/playerProfileExport";

const props = defineProps<{
  player: BasketballPlayer;
}>();

function exportJson(): string {
  return basketballPlayerProfileToJson(props.player);
}

function exportCsv(): string {
  return basketballPlayerProfileToCsv(props.player);
}
</script>
