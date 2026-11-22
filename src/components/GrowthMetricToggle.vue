<template>
  <div class="growth-metric-toggle" role="group" aria-label="Chart metric">
    <button
      type="button"
      :class="{ active: modelValue === 'skill' }"
      @click="select('skill')"
    >
      Skill
    </button>
    <button type="button" :class="{ active: modelValue === 'or' }" @click="select('or')">OR</button>
  </div>
</template>

<script setup lang="ts">
import { rememberGrowthMetric, type GrowthMetric } from "./growthMetric";

defineProps<{ modelValue: GrowthMetric }>();
const emit = defineEmits<{ "update:modelValue": [GrowthMetric] }>();

const select = (metric: GrowthMetric) => {
  rememberGrowthMetric(metric);
  emit("update:modelValue", metric);
};
</script>

<style scoped>
.growth-metric-toggle {
  display: flex;
  gap: 4px;
  margin-right: 12px;
}

.growth-metric-toggle button {
  padding: 4px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.growth-metric-toggle button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}
</style>
