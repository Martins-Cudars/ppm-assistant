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

/* PPM's page CSS styles bare <button>s (white text, orange hover gradient),
   so every state sets its colours, background image and shadows itself. */
.growth-metric-toggle button {
  padding: 4px 12px;
  border: 1px solid #ccc;
  background: #fff;
  background-image: none;
  color: #333;
  text-shadow: none;
  box-shadow: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: normal;
  line-height: 1.4;
}

.growth-metric-toggle button:hover,
.growth-metric-toggle button:focus {
  background: #f0f4fa;
  background-image: none;
  color: #333;
  border-color: #007bff;
}

.growth-metric-toggle button:focus-visible {
  outline: 2px solid #007bff;
  outline-offset: 1px;
}

.growth-metric-toggle button.active,
.growth-metric-toggle button.active:hover,
.growth-metric-toggle button.active:focus {
  background: #007bff;
  background-image: none;
  color: #fff;
  border-color: #007bff;
}
</style>
