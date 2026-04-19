<template>
  <div class="player-growth-chart">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { renderPotentialChart } from "@/charts";
import { SoccerPlayer } from "@/sports/soccer/classes/SoccerPlayer";
import { playerGrowthPrediction } from "@/sports/soccer/settings";

const props = defineProps<{
  player: SoccerPlayer;
}>();

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: { destroy: () => void } | null = null;

const renderChart = () => {
  if (!chartCanvas.value) return;

  chartInstance?.destroy();

  const bestPosition = props.player.getBestPosition();

  chartInstance = renderPotentialChart(
    {
      age: props.player.age,
      skill: bestPosition.baseRating,
      position: bestPosition.name,
      exp: props.player.experience,
    },
    playerGrowthPrediction,
    chartCanvas.value
  );
};

onMounted(() => {
  renderChart();
});

onUnmounted(() => {
  chartInstance?.destroy();
});

watch(
  () => props.player,
  () => {
    renderChart();
  },
  { deep: true }
);
</script>

<style scoped>
.player-growth-chart {
  width: 100%;
  background: #fff;
  padding: 20px;
  margin-top: 20px;
  border: 1px solid #c9c9c9;
  border-radius: 5px;
  box-sizing: border-box;
}
</style>
