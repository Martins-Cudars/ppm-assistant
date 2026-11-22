<script setup lang="ts">
import { computed } from "vue";
import {
  relativePercent,
  relativeSkillClass,
  relativeSkillTitle,
} from "@/base/relativeSkill";

const props = defineProps<{
  skill: number;
  /** 100% among every scouted team (player.getRelativeSkillMaxima().global). */
  maxSkillForAge: number | null;
  /** 100% within the viewer's league; null or absent hides that half. */
  leagueMaxSkillForAge?: number | null;
}>();

const global = computed(() => relativePercent(props.skill, props.maxSkillForAge));
const league = computed(() => relativePercent(props.skill, props.leagueMaxSkillForAge));
const title = computed(() =>
  global.value !== null && league.value !== null
    ? relativeSkillTitle(global.value, league.value)
    : undefined
);
</script>

<template>
  <div class="relative-skill" :title="title">
    <template v-if="global !== null">
      <span :class="relativeSkillClass(global)">{{ global }}%</span>
      <template v-if="league !== null">
        <span class="relative-skill__separator"> / </span>
        <span :class="relativeSkillClass(league)">{{ league }}%</span>
      </template>
    </template>
    <span v-else class="relative-skill__none">–</span>
  </div>
</template>
