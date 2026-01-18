<template>
  <div
    :class="['freshness-badge', freshnessClass]"
    :title="tooltipText"
  >
    <span class="freshness-indicator"></span>
    <span class="freshness-label">{{ freshnessLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { isNewSeason } from '@/storage/storageKeys';

interface Props {
  updatedAt: Date;
  seasonDay: number;
  currentSeasonDay: number;
}

const props = defineProps<Props>();

const daysSinceUpdate = computed(() => {
  const now = new Date();
  const diffMs = now.getTime() - props.updatedAt.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
});

const isSeasonExpired = computed(() => {
  return isNewSeason(props.seasonDay, props.currentSeasonDay);
});

const freshnessClass = computed(() => {
  if (isSeasonExpired.value) return 'expired';
  const days = daysSinceUpdate.value;
  if (days <= 1) return 'fresh';
  if (days <= 7) return 'stale';
  return 'very-stale';
});

const freshnessLabel = computed(() => {
  if (isSeasonExpired.value) return 'Old Season';
  const days = daysSinceUpdate.value;
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 7) return `${days}d ago`;
  return `${days}d ago`;
});

const tooltipText = computed(() => {
  if (isSeasonExpired.value) {
    return `Data from previous season (day ${props.seasonDay}). Current season is day ${props.currentSeasonDay}.`;
  }
  const timestamp = props.updatedAt.toLocaleString();
  const days = daysSinceUpdate.value;
  if (days === 0) return `Updated today at ${props.updatedAt.toLocaleTimeString()}`;
  if (days === 1) return `Updated yesterday (${timestamp})`;
  return `Updated ${days} days ago (${timestamp})`;
});
</script>

<style scoped>
.freshness-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  cursor: help;
  transition: all 0.2s;
}

.freshness-badge:hover {
  transform: scale(1.05);
}

.freshness-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.freshness-badge.fresh {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.freshness-badge.fresh .freshness-indicator {
  background-color: #28a745;
  box-shadow: 0 0 4px #28a745;
}

.freshness-badge.stale {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.freshness-badge.stale .freshness-indicator {
  background-color: #ffc107;
}

.freshness-badge.very-stale {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.freshness-badge.very-stale .freshness-indicator {
  background-color: #dc3545;
}

.freshness-badge.expired {
  background-color: #e2e3e5;
  color: #383d41;
  border: 1px solid #d6d8db;
}

.freshness-badge.expired .freshness-indicator {
  background-color: #6c757d;
}

.freshness-label {
  white-space: nowrap;
}
</style>
