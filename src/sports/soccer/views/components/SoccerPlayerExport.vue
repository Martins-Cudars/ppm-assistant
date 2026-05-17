<template>
  <PlayerProfileExport :to-json="exportJson" :to-csv="exportCsv" />
</template>

<script setup lang="ts">
import PlayerProfileExport from "@/components/PlayerProfileExport.vue";
import { SoccerPlayer } from "@/sports/soccer/classes/SoccerPlayer";
import {
  soccerPlayerProfileToCsv,
  soccerPlayerProfileToJson,
} from "@/sports/soccer/utils/playerProfileExport";

const props = defineProps<{
  player: SoccerPlayer;
}>();

function exportJson(): string {
  return soccerPlayerProfileToJson(props.player);
}

function exportCsv(): string {
  return soccerPlayerProfileToCsv(props.player);
}
</script>
