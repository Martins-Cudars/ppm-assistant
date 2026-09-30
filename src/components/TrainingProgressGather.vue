<template>
  <div class="training-progress-gather">
    <template v-if="state === 'idle'">
      <button :title="hintTitle" :disabled="!hasPrevious" @click="$emit('start')">
        Gather history<template v-if="showCount"> ({{ totalMonths }})</template>
      </button>
    </template>

    <template v-else-if="state === 'gathering'">
      <div class="gather-row">
        <span class="gather-status">
          <span class="gather-spinner" aria-hidden="true"></span>
          Gathering… {{ monthLabel }}
        </span>
        <button class="gather-stop" @click="$emit('stop')">Stop</button>
      </div>
      <div class="gather-meta">{{ progressText }}</div>
      <div v-if="totalMonths > 0" class="gather-bar">
        <div class="gather-bar-fill" :style="{ width: `${percent}%` }"></div>
      </div>
    </template>

    <template v-else>
      <span class="gather-status gather-done">✔ Gathered {{ progressText }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    state: "idle" | "gathering" | "finished";
    monthsVisited?: number;
    /** 0 when the page's month bounds couldn't be read - progress then has no denominator. */
    totalMonths?: number;
    entriesWritten?: number;
    hasPrevious?: boolean;
    monthLabel?: string;
  }>(),
  {
    monthsVisited: 0,
    totalMonths: 0,
    entriesWritten: 0,
    hasPrevious: false,
    monthLabel: "",
  }
);

defineEmits<{ (event: "start"): void; (event: "stop"): void }>();

// No "(1)" on a single-month walk, and nothing at all when the bounds are unknown.
const showCount = computed(() => props.hasPrevious && props.totalMonths > 1);

const percent = computed(() =>
  props.totalMonths > 0
    ? Math.min(100, (props.monthsVisited / props.totalMonths) * 100)
    : 0
);

const progressText = computed(() => {
  const showTotal = props.state === "gathering" && props.totalMonths > 0;
  const months = showTotal
    ? `${props.monthsVisited}/${props.totalMonths} months`
    : `${props.monthsVisited} ${props.monthsVisited === 1 ? "month" : "months"}`;
  const entries = `${props.entriesWritten} ${props.entriesWritten === 1 ? "entry" : "entries"}`;
  return `${months} · ${entries}`;
});

const hintTitle = computed(() => {
  if (!props.hasPrevious) return "Earliest month reached";
  return props.totalMonths > 1
    ? `Walks back ${props.totalMonths} months to the oldest one`
    : "Walks back month by month to the oldest one";
});
</script>

<style scoped>
/*
 * Everything below is mounted inside the game's .select_form card, which passes
 * down color, font, line-height and text-transform: uppercase, and whose global
 * button rule sets color: #fff, height, margin and display. Inherited and
 * button-level properties are therefore declared explicitly rather than left to
 * default - anything left undeclared is inherited from the game instead.
 *
 * The --gather-btn-* custom properties are mirrored off the card's own "Mainīt"
 * submit button by applyGameButtonStyle() in viewTrainingProgress.ts, so the
 * button matches it exactly (sprite background included). The fallbacks keep it
 * readable if that button ever stops being there.
 */
.training-progress-gather {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  color: #333;
  font-family: "Open Sans", sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: normal;
  text-transform: none;
}

.gather-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.training-progress-gather button {
  display: inline-block;
  height: var(--gather-btn-height, 25px);
  margin: 0;
  padding: var(--gather-btn-padding, 4px 7px);
  color: var(--gather-btn-color, #fff);
  background-color: var(--gather-btn-bg-color, #3b5da9);
  background-image: var(--gather-btn-bg-image, none);
  background-repeat: var(--gather-btn-bg-repeat, repeat-x);
  background-position: var(--gather-btn-bg-position, 0 0);
  border: 0;
  border-radius: var(--gather-btn-radius, 4px);
  box-shadow: none;
  font-family: var(--gather-btn-font-family, "Open Sans", sans-serif);
  font-size: var(--gather-btn-font-size, 11px);
  font-weight: var(--gather-btn-font-weight, 400);
  line-height: normal;
  text-transform: none;
  text-align: center;
  cursor: pointer;
  transition: filter 0.2s;
}

/* Brightness rather than a background-color swap, so it also lifts the sprite. */
.training-progress-gather button:hover:not(:disabled) {
  filter: brightness(1.1);
}

.training-progress-gather button:disabled {
  opacity: 0.5;
  cursor: default;
  filter: none;
}

.gather-stop {
  background-image: none;
  background-color: #b3383f;
}

.gather-status {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #555;
  font-size: 12px;
  font-weight: 700;
  text-transform: none;
}

.gather-done {
  color: #2b7a3d;
}

.gather-meta {
  color: #666;
  font-size: 11px;
}

.gather-bar {
  width: 100%;
  max-width: 260px;
  height: 4px;
  background: #d8d8d8;
  border-radius: 2px;
  overflow: hidden;
}

/*
 * A literal blue, deliberately not var(--gather-btn-bg-color): the game paints
 * its buttons with a sprite and leaves background-color transparent, so that
 * variable would render an invisible bar.
 */
.gather-bar-fill {
  height: 100%;
  background: #3b5da9;
  transition: width 0.2s;
}

.gather-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #ddd;
  border-top-color: #3b5da9;
  border-radius: 50%;
  animation: gather-spin 0.8s linear infinite;
}

@keyframes gather-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
