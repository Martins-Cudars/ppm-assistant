<template>
  <PlayerProfileExport :to-json="exportJson" :to-csv="exportCsv" />
</template>

<script setup lang="ts">
import PlayerProfileExport from "@/components/PlayerProfileExport.vue";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import {
  hockeyPlayerProfileToCsv,
  hockeyPlayerProfileToJson,
} from "@/sports/hockey/utils/playerProfileExport";

const props = defineProps<{
  player: HockeyPlayer;
}>();

function exportJson(): string {
  return hockeyPlayerProfileToJson(props.player);
}

function exportCsv(): string {
  return hockeyPlayerProfileToCsv(props.player);
}
</script>
