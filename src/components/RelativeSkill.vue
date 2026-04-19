<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  skill: number;
  maxSkillForAge: number;
}>();

const relativeSkill = computed(() => {
  if (!props.maxSkillForAge) return 0;
  return Math.round((props.skill / props.maxSkillForAge) * 100);
});

const relativeSkillClass = computed(() => {
  const rounded = Math.floor(relativeSkill.value / 5) * 5;
  return `relative-skill--${rounded}`;
});
</script>

<template>
  <div class="relative-skill" :class="relativeSkillClass">
    {{ relativeSkill }}%
  </div>
</template>

<style scoped>
/* Styles are likely global or imported, but we can add scoped styles if needed. 
   The original code used classes like 'relative-skill--95'. 
   We assume these classes are defined in the global CSS. 
*/
.relative-skill {
  font-weight: bold;
  text-align: center;
}
</style>
