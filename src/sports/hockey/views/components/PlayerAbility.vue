<template>
  <div class="player-profile player-profile--ability">
    <div class="ability__position">{{ bestPosition.name }}</div>
    <div class="ability__comparison">
      <RatingStars
        :skill="bestPosition.ratingWithXp"
        :settings="ratingSettings"
      />
    </div>
    <div class="ability__text">
      <div class="ability__value">
        <div>{{ bestPosition.ratingWithXp }}</div>
        <div>
          ({{ bestPosition.baseRating }} + {{ bestPosition.bonusRating }} +
          {{ bestPosition.expBonus }})
        </div>
      </div>
    </div>
    <div class="ability__positions">
      <div v-for="pos in positions" :key="pos.name">
        {{ pos.name }} {{ pos.ratingWithXp }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { ratingSettings } from "@/sports/hockey/settings";
import RatingStars from "@/components/RatingStars.vue";

const props = defineProps<{
  player: HockeyPlayer;
}>();

const positions = computed(() => props.player.getPositions());
const bestPosition = computed(() => props.player.getBestPosition());
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

.ability__position {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 5px;
}

.ability__comparison {
  margin-bottom: 5px;
}

.ability__text {
  text-align: center;
}

.ability__value {
  font-size: 14px;
}

.ability__positions {
  margin-top: 10px;
  font-size: 12px;
  color: #666;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 5px;
}
</style>
