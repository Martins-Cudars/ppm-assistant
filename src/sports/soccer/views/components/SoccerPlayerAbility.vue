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
        <RelativeSkill
          :skill="relativeSkill"
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
import RelativeSkill from "@/components/RelativeSkill.vue";
import { leagueLine } from "@/base/scout/leagueRelativeSkill";
import RatingStars from "@/components/RatingStars.vue";
import { SoccerPlayer } from "@/sports/soccer/classes/SoccerPlayer";
import { ratingSettings } from "@/sports/soccer/settings";
import { getSoccerRelativeSkill } from "@/sports/soccer/utils/playerRatings";

const props = defineProps<{
  player: SoccerPlayer;
}>();

const positions = computed(() => props.player.getPositions());
const bestPosition = computed(() => props.player.getBestPosition());
// The view loaded the league line (loadLeagueReference); "loading" until it arrives.
const league = computed(() => leagueLine("soccer"));
const maxima = computed(() => props.player.getRelativeSkillMaxima(league.value.table));
const relativeSkill = computed(() => getSoccerRelativeSkill(props.player));
</script>
