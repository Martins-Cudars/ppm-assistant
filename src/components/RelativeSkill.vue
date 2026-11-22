<script setup lang="ts">
import { computed } from "vue";
import {
  LeagueLineStatus,
  RelativeSkillMaxima,
  relativeSkillClass,
  relativeSkillView,
} from "@/base/relativeSkill";

const props = defineProps<{
  skill: number;
  /** player.getRelativeSkillMaxima(league table). */
  maxima: RelativeSkillMaxima;
  /** The player's whole age, named when there is no reference for it. */
  age: number;
  /** Why the league value may be missing (leagueLine(sport).status). */
  leagueStatus: LeagueLineStatus;
}>();

const view = computed(() => relativeSkillView(props.skill, props.maxima, props.age, props.leagueStatus));
</script>

<template>
  <div class="relative-skill" :title="view.title">
    <span v-if="view.global !== null" :class="relativeSkillClass(view.global)">{{ view.global }}%</span>
    <span v-else class="relative-skill__none">???</span>
    <span class="relative-skill__separator"> / </span>
    <span v-if="view.league !== null" :class="relativeSkillClass(view.league)">{{ view.league }}%</span>
    <span v-else class="relative-skill__none">???</span>
  </div>
</template>
