<template>
  <div class="player-growth-chart">
    <div class="chart-header">
      <span class="chart-title">{{
        metric === "or" ? "Growth (OR)" : "Growth (best position, no XP unless marked)"
      }}</span>
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
    <div class="chart-body">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The basketball profile's growth chart, on hockey's PlayerGrowthChart
 * pattern and against the same kind of reference:
 *
 * - grey: the top-5% line (relative skill's 100%), with and without XP;
 * - red: today's rating, without and with XP;
 * - blue: the stored history, each day rated with that day's height;
 * - dashed blue: the projection at the player's own pace against that line,
 *   as the report's @25 column computes it.
 *
 * The OR view draws the same without XP: the top-5% OR line, today's OR, the
 * OR history and the projection at the player's OR pace (basketballOrModel).
 */
import { computed, onMounted, ref } from "vue";
import { BasketballPlayer, BasketballSkills } from "@/sports/basketball/classes/BasketballPlayer";
import { normalizePlayerId } from "@/sports/basketball/capture";
import { basketballPlayerProfile } from "@/sports/basketball/playerProfile";
import {
  BASKETBALL_REFERENCE_CURVE,
  REFERENCE_LAST_AGE,
  basketballOrModel,
  measureBasketballPace,
} from "@/sports/basketball/growthModel";
import { relativeOrReference, relativeSkillReference } from "@/sports/basketball/relativeSkillReference";
import { Point, historyPoints, projectionPoints } from "@/sports/basketball/historyChart";
import { getSkillHistoryForPlayer } from "@/storage/skillHistoryDb";
import { calculateSkillWithExp } from "@/base/calculations";
import { SkillHistoryEntry } from "@/types/SkillHistory";
import { getCurrentSeasonDay } from "@/utils/dom";
import GrowthMetricToggle from "@/components/GrowthMetricToggle.vue";
import {
  orDatasets,
  orProjectionDataset,
  orReferenceDataset,
  useGrowthMetric,
  type KeyedDataset,
} from "@/components/growthMetric";
import { useProfileGrowthChart } from "@/components/growthChart";

const props = defineProps<{ player: BasketballPlayer }>();

type Entry = SkillHistoryEntry<BasketballSkills>;

const chartCanvas = ref<HTMLCanvasElement | null>(null);

const minAge = ref(Math.max(15, Math.floor(props.player.age) - 3));
const maxAge = ref(Math.min(45, Math.ceil(props.player.age) + 5));

const playerId = normalizePlayerId(props.player.id) ?? props.player.id;
const exactAge = props.player.age + (getCurrentSeasonDay() || 1) / basketballPlayerProfile.daysPerSeason;

// Filled in by load(); the chart draws the current point straight away and
// the rest once the history arrives.
// Own rows kept so the toggle can re-derive the history without re-querying.
// OR-only rows (unscouted players) have no skills, so they show in OR mode only.
const ownEntries = ref<Entry[]>([]);
// An unscouted player has no skills: his chart opens on OR.
const metric = useGrowthMetric(props.player.hasKnownSkills() ? {} : { force: "or" });
// Derived, so a new metric or freshly loaded rows can never leave it stale.
const history = computed<Point[]>(() =>
  historyPoints(ownEntries.value, exactAge, metric.value, props.player.height)
);
const projection = ref<Point[]>([]);
const pace = ref<{ value: number; provisional: boolean } | null>(null);
// The OR view's projection, at the player's OR pace against the top-5% OR line.
const orProjection = ref<Point[]>([]);
const orPace = ref<{ value: number; provisional: boolean } | null>(null);

const load = async () => {
  const own = (await getSkillHistoryForPlayer(playerId, "basketball")) as unknown as Entry[];
  ownEntries.value = own;

  const measured = measureBasketballPace(own, exactAge);
  pace.value =
    measured?.pace != null ? { value: measured.pace, provisional: measured.provisional } : null;
  projection.value = projectionPoints(
    props.player.skills,
    props.player.height,
    exactAge,
    measured,
    BASKETBALL_REFERENCE_CURVE,
    REFERENCE_LAST_AGE + 1
  );
  // Measured on skills where the history has them, else on the OR numbers,
  // so an unscouted player gets one too.
  const orModel = basketballOrModel();
  const measuredOr = orModel.measureOrPace(own, exactAge);
  orPace.value =
    measuredOr?.pace != null ? { value: measuredOr.pace, provisional: measuredOr.provisional } : null;
  orProjection.value = orModel.orProjectionPoints(
    props.player.overallRating,
    exactAge,
    measuredOr,
    REFERENCE_LAST_AGE + 1
  );
  render();
};

/** A grey top-5% line, as hockey's and soccer's charts draw it. */
const topDataset = (key: string, data: Point[], label: string): KeyedDataset => ({
  key,
  label,
  data,
  borderColor: "#ccc",
  backgroundColor: "#ccc",
  borderWidth: 2,
  pointRadius: 2,
  pointBackgroundColor: "#fff",
  tension: 0.4,
  // Monotone: a plain spline overshoots between ages.
  cubicInterpolationMode: "monotone",
});

const buildDatasets = (): KeyedDataset[] => {
  if (metric.value === "or") {
    // OR view: the top-5% OR line, today's OR, the OR history and the
    // projection at the player's OR pace. No XP variant: OR has no XP.
    const datasets: KeyedDataset[] = [orReferenceDataset(relativeOrReference)];
    const projected = orProjectionDataset(orProjection.value, orPace.value);
    return datasets.concat(
      orDatasets({ exactAge, current: props.player.overallRating, history: history.value }),
      projected ? [projected] : []
    );
  }

  const best = props.player.getBestPosition();
  const datasets: KeyedDataset[] = [
    topDataset(
      "top-with-xp",
      relativeSkillReference.map((p) => ({ x: p.age, y: calculateSkillWithExp(p.skill, p.exp) })),
      "Top 5% (with XP)"
    ),
    topDataset(
      "top-no-xp",
      relativeSkillReference.map((p) => ({ x: p.age, y: p.skill })),
      "Top 5% (no XP)"
    ),
  ];
  // An unscouted player's rating is a guess from OR: no "now" points for it.
  if (props.player.hasKnownSkills()) datasets.push(
    {
      key: "now-with-xp",
      label: `Now with XP (${best.name})`,
      data: [{ x: exactAge, y: best.ratingWithXp }],
      borderColor: "rgba(255, 99, 132, 1)",
      backgroundColor: "rgba(255, 99, 132, 0.5)",
      pointRadius: 10,
      pointHoverRadius: 12,
      showLine: false,
    },
    {
      key: "now",
      label: `Now (${best.name})`,
      data: [{ x: exactAge, y: best.ratingWithBonus }],
      borderColor: "rgba(255, 99, 132, 1)",
      backgroundColor: "rgba(255, 99, 132, 1)",
      pointRadius: 10,
      pointHoverRadius: 12,
      showLine: false,
    }
  );
  // Omitted rather than drawn empty: a player never seen on the squad
  // overview or training-progress page simply has no history yet.
  if (history.value.length > 0) {
    datasets.push({
      key: "history",
      label: "History",
      data: history.value,
      borderColor: "rgba(54, 162, 235, 1)",
      backgroundColor: "rgba(54, 162, 235, 1)",
      borderWidth: 2,
      pointRadius: 2,
      tension: 0,
    });
  }
  if (projection.value.length > 0 && pace.value) {
    const { value, provisional } = pace.value;
    datasets.push({
      key: "projection",
      label: `Projected at own pace (${provisional ? "~" : ""}${Math.round(value * 100)}%${provisional ? ", provisional" : ""})`,
      data: projection.value,
      borderColor: "rgba(54, 162, 235, 1)",
      backgroundColor: "rgba(54, 162, 235, 1)",
      borderWidth: 2,
      borderDash: [6, 4],
      pointRadius: 0,
      tension: 0,
    });
  }
  return datasets;
};

// The chart, its age range and metric switch, and the legend's hidden lines:
// shared by the three profile charts (src/components/growthChart.ts).
const { render } = useProfileGrowthChart({
  name: "BasketballGrowthChart",
  canvas: chartCanvas,
  minAge,
  maxAge,
  metric,
  buildDatasets,
  tooltip: {
    callbacks: {
      label: (context) => {
        const point = context.raw as Point;
        return `${context.dataset.label}: ${point.y} (Age ${point.x.toFixed(1)})`;
      },
    },
  },
});

onMounted(() => {
  render();
  load().catch((error) => console.error("[BasketballGrowthChart] Failed to load history:", error));
});
</script>

<style scoped>
.player-growth-chart {
  width: 100%;
  height: 420px;
  display: flex;
  flex-direction: column;
  background: #fff;
  padding: 16px 20px;
  margin-top: 20px;
  border: 1px solid #c9c9c9;
  border-radius: 5px;
  box-sizing: border-box;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
  margin-bottom: 8px;
}

.chart-title {
  font-weight: 600;
  margin-right: auto;
}

.age-input {
  width: 50px;
  margin: 0 5px;
}

.chart-body {
  flex: 1;
  min-height: 0;
  position: relative;
}
</style>
