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
      Current position ({{ currentPositionTrainingQualities.position }})
      training quality is
      {{ currentPositionTrainingQualities.totalTrainingQuality }}
      ({{ currentPositionTrainingQualities.baseTrainingQuality }} +
      {{ currentPositionTrainingQualities.bonusTrainingQuality }})
    </div>
    <div class="potential__positions">
      <div v-for="pot in potentials" :key="pot.position">
        {{ pot.position }} {{ pot.totalTrainingQuality }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { potentialGrade } from "@/base/utilities";

const props = defineProps<{
  player: HockeyPlayer;
}>();

const potentials = computed(() => props.player.getPositionTrainingQualities());
const currentPositionTrainingQualities = computed(() =>
  props.player.getCurrentPositionTrainingQuality()
);

const potentialGradeObj = computed(() =>
  potentialGrade(currentPositionTrainingQualities.value.totalTrainingQuality)
);
</script>

<style scoped>
.player-profile {
  background: #fff;
  border: 1px solid #c9c9c9;
  border-radius: 5px;
  padding: 10px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.potential__badge {
  padding: 5px 10px;
  border-radius: 5px;
  color: #fff;
  font-weight: bold;
  margin-bottom: 5px;
}

.potential__badge--low {
  background-color: #d9534f;
}

.potential__badge--medium {
  background-color: #f0ad4e;
}

.potential__badge--high {
  background-color: #5cb85c;
}

.potential__badge--elite {
  background-color: #5bc0de;
}

.potential__text {
  text-align: center;
  font-size: 14px;
}

.potential__positions {
  margin-top: 10px;
  font-size: 12px;
  color: #666;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 5px;
}
</style>
