<template>
  <div class="filters white_box">
    <div class="filter-group">
      <label>Compare with:</label>
      <button
        v-for="option in options"
        :key="option.key"
        :class="{ active: choice === option.key }"
        @click="choice = option.key"
      >
        {{ option.name }}
      </button>
    </div>
    <span class="compare-caption">{{ caption }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * The Player Reports' "Compare with: Squad · League · Elite" row and the line
 * that says what the choice rests on. The choice and caption come from
 * useCompareWith (src/base/scout/useCompareWith.ts); the row styles are the
 * shared report filters' (reportTable.css).
 */
const choice = defineModel<string>({ required: true });

defineProps<{
  options: readonly { key: string; name: string }[];
  caption: string;
}>();
</script>

<style scoped>
.compare-caption {
  font-size: 12px;
  color: #666;
}
</style>
