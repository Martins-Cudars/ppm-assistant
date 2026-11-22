<script setup lang="ts">
import { computed } from "vue";
import {
  relativePercent,
  relativeSkillClass,
  relativeSkillTitle,
} from "@/base/relativeSkill";

const props = defineProps<{
  skill: number;
  /** 100% among every scouted team: player.getMaxSkillForAge(). */
  maxSkillForAge: number;
  /** 100% within the user's league: player.getMaxSkillForAge("league"). */
  leagueMaxSkillForAge?: number;
}>();

const global = computed(() => relativePercent(props.skill, props.maxSkillForAge));
const league = computed(() =>
  props.leagueMaxSkillForAge === undefined
    ? null
    : relativePercent(props.skill, props.leagueMaxSkillForAge)
);
const title = computed(() =>
  league.value === null
    ? undefined
    : relativeSkillTitle({ global: global.value, league: league.value })
);
</script>

<template>
  <div class="relative-skill" :title="title">
    <span :class="relativeSkillClass(global)">{{ global }}%</span>
    <template v-if="league !== null">
      <span class="relative-skill__separator"> / </span>
      <span :class="relativeSkillClass(league)">{{ league }}%</span>
    </template>
  </div>
</template>

<style scoped>
.relative-skill {
  font-weight: bold;
  text-align: center;
  white-space: nowrap;
}

.relative-skill__separator {
  font-weight: normal;
  color: #999;
}
</style>
