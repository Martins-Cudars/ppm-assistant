<template>
  <span v-if="value !== null && value !== undefined" :class="{ projected: provisional }" :title="title">
    {{ provisional ? "~" : "" }}{{ Math.round(value * 100) }}%
  </span>
  <span v-else class="history-none" :title="title">-</span>
</template>

<script setup lang="ts">
/**
 * A share as a whole percentage, or "-" when there is none - the Player
 * Reports' "OR vs best" and Pace cells. A provisional value is marked "~" and
 * styled as a projection (reportTable.css).
 */
defineProps<{
  value: number | null | undefined;
  title: string;
  provisional?: boolean;
}>();
</script>
