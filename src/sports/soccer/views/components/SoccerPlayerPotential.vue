<template>
  <div class="player-profile player-profile--potential">
    <div
      :class="[
        'potential__badge',
        `potential__badge--${potentialGradeObj.class}`,
      ]"
    >
      {{ potentialGradeObj.label }}
    </div>
    <div class="potential__text">
      Current position ({{ currentPositionTrainingQuality.position }}) training
      quality is {{ currentPositionTrainingQuality.totalTrainingQuality }}
      ({{ currentPositionTrainingQuality.baseTrainingQuality }} +
      {{ currentPositionTrainingQuality.bonusTrainingQuality }})
    </div>
    <div class="potential__positions">
      <div v-for="potential in potentials" :key="potential.position">
        {{ potential.position }} {{ potential.totalTrainingQuality }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { potentialGrade } from "@/base/utilities";
import { SoccerPlayer } from "@/sports/soccer/classes/SoccerPlayer";

const props = defineProps<{
  player: SoccerPlayer;
}>();

const potentials = computed(() => props.player.getPositionTrainingQualities());
const currentPositionTrainingQuality = computed(() =>
  props.player.getPositionTrainingQuality(
    props.player.getBestPosition().name
  ) ?? props.player.getBestPositionTrainingQuality()
);
const potentialGradeObj = computed(() =>
  potentialGrade(currentPositionTrainingQuality.value.totalTrainingQuality)
);
</script>
