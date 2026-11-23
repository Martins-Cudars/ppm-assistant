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
        <div>({{ bestPosition.ratingWithBonus }})</div>
        <RelativeSkill
          :skill="bestPosition.ratingWithXp"
          :maxima="maxima"
          :age="player.age"
          :leagueStatus="league.status"
        />
      </div>
    </div>
    <div class="ability__positions">
      <div v-for="position in positions" :key="position.name">
        {{ position.name }} {{ position.ratingWithXp }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import RatingStars from "@/components/RatingStars.vue";
import RelativeSkill from "@/components/RelativeSkill.vue";
import { leagueLine } from "@/base/scout/leagueRelativeSkill";
import { BasketballPlayer } from "@/sports/basketball/classes/BasketballPlayer";
import { ratingSettings } from "@/sports/basketball/settings";

const props = defineProps<{
  player: BasketballPlayer;
}>();

const positions = computed(() => props.player.getPositions());
const bestPosition = computed(() => props.player.getBestPosition());
// The view loaded the league line (loadLeagueReference); "loading" until it arrives.
const league = computed(() => leagueLine("basketball"));
const maxima = computed(() => props.player.getRelativeSkillMaxima(league.value.table));
</script>
