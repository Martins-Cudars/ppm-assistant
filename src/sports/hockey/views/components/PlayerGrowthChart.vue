<template>
  <div class="player-growth-chart">
    <div class="chart-header">
      <GrowthMetricToggle v-model="metric" />
      <div class="age-filter">
        <label>
          Age:
          <input type="number" v-model.number="minAge" min="15" max="45" class="age-input" />
          -
          <input type="number" v-model.number="maxAge" min="15" max="45" class="age-input" />
        </label>
      </div>
    </div>
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { relativeOrReference, relativeSkillReference } from "@/sports/hockey/relativeSkillReference";
import { getCurrentSeasonDay } from "@/utils/dom";
import { getSkillHistoryForPlayer } from "@/storage/skillHistoryDb";
import { SkillHistoryEntry } from "@/types/SkillHistory";
import type { OrPace } from "@/base/orGrowth";
import GrowthMetricToggle from "@/components/GrowthMetricToggle.vue";
import {
  orDatasets,
  orProjectionDataset,
  orReferenceDataset,
  useGrowthMetric,
  type KeyedDataset,
} from "@/components/growthMetric";
import { useProfileGrowthChart } from "@/components/growthChart";
import { getExactAge, historyPoints } from "@/sports/hockey/skillHistoryChart";
import {
  measureGrowthPace,
  measureOrPace,
  orProjectionPoints,
  projectionPoints,
} from "@/sports/hockey/growthPace";

const props = defineProps<{
  player: HockeyPlayer;
}>();

const chartCanvas = ref<HTMLCanvasElement | null>(null);
const historyEntries = ref<SkillHistoryEntry[]>([]);
// The OR view's pace, measured once when the history loads (src/base/orGrowth.ts).
const orPace = ref<OrPace | null>(null);
// An unscouted player has no skills: his chart opens on OR.
const metric = useGrowthMetric(props.player.hasKnownSkills() ? {} : { force: "or" });

// Default to a window around the player's current age rather than the full
// 15-45 data range, so a young player's progress isn't squeezed into a
// sliver of the chart. Computed once from the initial player prop; the user
// can widen/narrow via the age-filter inputs afterwards.
const minAge = ref(Math.max(15, Math.floor(props.player.age) - 3));
const maxAge = ref(Math.min(45, Math.ceil(props.player.age) + 5));

const currentExactAge = () => getExactAge(props.player, getCurrentSeasonDay() || 1);

// Skill mode only: the OR view needs none of this (see buildDatasets).
const calculateData = () => {
  const projectedPureData = [];
  const projectedTotalData = [];
  const currentPureData = [];
  const currentTotalData = [];

  const bestPos = props.player.getBestPosition();
  const currentPureSkill = bestPos.ratingWithBonus;
  const currentTotalSkill = bestPos.ratingWithXp;

  // We loop from 15 to 45
  for (let age = 15; age <= 45; age++) {
    const targetGrowthData = relativeSkillReference.find((p) => p.age === age);

    if (targetGrowthData) {
      // Base / Pure skill line
      projectedPureData.push({ x: age, y: targetGrowthData.skill });

      // Total skill line (Skill + Exp bonus)
      const total = Math.round(
        targetGrowthData.skill * (1 + targetGrowthData.exp / 500)
      );
      projectedTotalData.push({ x: age, y: total });
    }
  }

  // Player position
  const exactAge = currentExactAge();

  // An unscouted player's rating is a guess from OR: no "now" point for it.
  if (props.player.hasKnownSkills()) {
    currentPureData.push({ x: exactAge, y: currentPureSkill });
    currentTotalData.push({ x: exactAge, y: currentTotalSkill });
  }

  // Actual skill history, sourced from prior visits to treninu-progress.html
  // and from profile visits. Entries captured from an unscouted player's
  // profile carry an overall rating but no attributes, so they yield no base
  // rating and drop out here (historyPoints filters before thinning).
  const actualHistoryData = historyPoints(historyEntries.value, exactAge, "skill");

  // Where the player lands if their recent pace holds, assuming balanced
  // training for their best position from here, starting from the red
  // current-point marker. Empty - and so omitted - without a measurable pace.
  // Runs to 35 regardless of the visible window; the x-axis clips it.
  const growthPace = measureGrowthPace(historyEntries.value, exactAge, bestPos.name);
  const pace = growthPace?.pace ?? null;
  const ownPaceProjection = projectionPoints(props.player.skills, exactAge, growthPace, 45);

  return {
    projectedPureData,
    projectedTotalData,
    currentPureData,
    currentTotalData,
    actualHistoryData,
    ownPaceProjection,
    pace,
    provisional: growthPace?.provisional ?? false,
  };
};

const buildDatasets = (): KeyedDataset[] => {
  if (metric.value === "or") {
    // OR view: the top-5% OR line, today's OR, the OR history and the
    // projection at the player's OR pace (src/base/orGrowth.ts) - measured on
    // his skills where the history has them, else on his OR numbers, so an
    // unscouted player gets one too. No with-XP split: OR has no XP.
    const exactAge = currentExactAge();
    const pace = orPace.value;
    const projection = orProjectionDataset(
      orProjectionPoints(props.player.overallRating, exactAge, pace, 45),
      pace?.pace != null ? { value: pace.pace, provisional: pace.provisional } : null
    );
    return [
      orReferenceDataset(relativeOrReference),
      ...orDatasets({
        exactAge,
        current: props.player.overallRating,
        history: historyPoints(historyEntries.value, exactAge, "or"),
      }),
      ...(projection ? [projection] : []),
    ];
  }

  const {
    projectedPureData,
    projectedTotalData,
    currentPureData,
    currentTotalData,
    actualHistoryData,
    ownPaceProjection,
    pace,
    provisional,
  } = calculateData();

  const datasets: KeyedDataset[] = [
    {
      key: "top-total",
      label: "Top 5% Skill (Total)",
      data: projectedTotalData,
      borderColor: "#ccc",
      backgroundColor: "#ccc",
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: "#fff",
      pointBorderColor: "#ccc",
      fill: false,
      tension: 0.4,
      // Monotone: a plain spline overshoots between ages and bulges at the
      // axis edge (the top line rose above 33 near 32.8 with 25-33 shown).
      cubicInterpolationMode: "monotone",
    },
    {
      key: "top-base",
      label: "Top 5% Skill (Base)",
      data: projectedPureData,
      borderColor: "#ccc",
      backgroundColor: "#ccc",
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: "#fff",
      pointBorderColor: "#ccc",
      fill: false,
      tension: 0.4,
      // Monotone: a plain spline overshoots between ages and bulges at the
      // axis edge (the top line rose above 33 near 32.8 with 25-33 shown).
      cubicInterpolationMode: "monotone",
    },
    {
      key: "now-total",
      label: "Current Skill (Total)",
      data: currentTotalData,
      borderColor: "rgba(255, 99, 132, 1)",
      backgroundColor: "rgba(255, 99, 132, 0.5)",
      pointRadius: 10,
      pointHoverRadius: 12,
      showLine: false,
    },
    {
      key: "now-base",
      label: "Current Skill (Base)",
      data: currentPureData,
      borderColor: "rgba(255, 99, 132, 1)",
      backgroundColor: "rgba(255, 99, 132, 1)",
      pointRadius: 10,
      pointHoverRadius: 12,
      showLine: false,
    },
  ].filter((dataset) => dataset.data.length > 0); // no "now" points when unscouted

  // Only add the actual-history line once there's data to show - omit it
  // entirely rather than showing an empty/misleading legend entry. History
  // and profile pages are visited independently, so a player never viewed on
  // treninu-progress.html simply won't have this line yet; that's expected.
  if (actualHistoryData.length > 0) {
    datasets.push({
      key: "history",
      label: "Actual Skill History (Base)",
      data: actualHistoryData,
      borderColor: "rgba(54, 162, 235, 1)",
      backgroundColor: "rgba(54, 162, 235, 1)",
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: "rgba(54, 162, 235, 1)",
      pointBorderColor: "rgba(54, 162, 235, 1)",
      fill: false,
      tension: 0,
    });
  }

  if (ownPaceProjection.length > 0 && pace !== null) {
    datasets.push({
      key: "projection",
      label: `Projected at own pace (${provisional ? "~" : ""}${Math.round(pace * 100)}%${provisional ? ", provisional" : ""})`,
      data: ownPaceProjection,
      borderColor: "rgba(54, 162, 235, 1)",
      backgroundColor: "rgba(54, 162, 235, 1)",
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 0,
      fill: false,
      tension: 0,
    });
  }

  return datasets;
};

// The chart, its age range and metric switch, and the legend's hidden lines:
// shared by the three profile charts (src/components/growthChart.ts).
const { render } = useProfileGrowthChart({
  name: "PlayerGrowthChart",
  canvas: chartCanvas,
  minAge,
  maxAge,
  metric,
  buildDatasets,
  tooltip: { mode: "index", intersect: false },
});

const loadHistory = () => {
  getSkillHistoryForPlayer(props.player.id).then((entries) => {
    historyEntries.value = entries;
    orPace.value = measureOrPace(entries, currentExactAge());
    render();
  });
};

onMounted(() => {
  render();
  loadHistory();
});

watch(
  () => props.player,
  () => {
    render();
  },
  { deep: true }
);
</script>

<style scoped>
.player-growth-chart {
  width: 100%;
  height: 400px;
  background: #fff;
  padding: 20px;
  margin-top: 20px;
  border: 1px solid #c9c9c9;
  border-radius: 5px;
  box-sizing: border-box;
}

.chart-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
  margin-bottom: 10px;
}

.age-filter {
  display: flex;
  align-items: center;
}

.age-input {
  width: 50px;
  margin: 0 5px;
}
</style>
