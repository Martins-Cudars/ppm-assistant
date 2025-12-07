<script setup lang="ts">
import { computed } from "vue";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { RatingSettings } from "@/types/Position";
import RatingStars from "@/components/RatingStars.vue";

const props = defineProps<{
  players: HockeyPlayer[];
  settings: RatingSettings;
}>();

const calculateAverage = (
  items: HockeyPlayer[],
  getValue: (p: HockeyPlayer) => number
) => {
  if (items.length === 0) return 0;
  const sum = items.reduce((acc, p) => acc + getValue(p), 0);
  return Math.round(sum / items.length);
};

const top22 = computed(() => {
  return [...props.players]
    .sort((a, b) => b.overallRating - a.overallRating)
    .slice(0, 22);
});

const top17 = computed(() => {
  return [...props.players]
    .sort((a, b) => b.overallRating - a.overallRating)
    .slice(0, 17);
});

const getPositionalStats = (position: string, count: number) => {
  const filtered = props.players.filter(
    (p) => p.getBestPosition().name === position
  );
  const top = filtered
    .sort(
      (a, b) =>
        b.getBestPosition().ratingWithXp - a.getBestPosition().ratingWithXp
    )
    .slice(0, count);

  return {
    count: top.length,
    avgSkill: calculateAverage(top, (p) => p.getBestPosition().ratingWithXp),
    avgAge: calculateAverage(top, (p) => p.age),
  };
};

const stats = computed(() => ({
  top22: {
    avgOr: calculateAverage(top22.value, (p) => p.overallRating),
    avgAge: calculateAverage(top22.value, (p) => p.age),
  },
  top17: {
    avgOr: calculateAverage(top17.value, (p) => p.overallRating),
    avgAge: calculateAverage(top17.value, (p) => p.age),
  },
  defenders: getPositionalStats("D", 8),
  wingers: getPositionalStats("W", 8),
  centers: getPositionalStats("C", 4),
  goalies: getPositionalStats("G", 2),
}));
</script>

<template>
  <div class="stats-container white_box">
    <h3>Team Statistics</h3>
    <div class="stats-grid">
      <div class="stat-group">
        <h4>General</h4>
        <div class="stat-row">
          <span class="general-label">Top 22:</span>
          <strong class="general-value">OR: {{ stats.top22.avgOr }}</strong>
          <span>(Age: {{ stats.top22.avgAge }})</span>
        </div>
        <div class="stat-row">
          <span class="general-label">Top 17:</span>
          <strong class="general-value">OR: {{ stats.top17.avgOr }}</strong>
          <span>(Age: {{ stats.top17.avgAge }})</span>
        </div>
      </div>

      <div class="stat-group">
        <h4>Positions</h4>
        <div class="stat-row">
          <span class="stat-label">Top 8 Defender Skill:</span>
          <strong class="stat-value">{{ stats.defenders.avgSkill }}</strong>
          <span class="stat-age">(Age: {{ stats.defenders.avgAge }})</span>
          <RatingStars :skill="stats.defenders.avgSkill" :settings="settings" />
        </div>
        <div class="stat-row">
          <span class="stat-label">Top 8 Winger Skill:</span>
          <strong class="stat-value">{{ stats.wingers.avgSkill }}</strong>
          <span class="stat-age">(Age: {{ stats.wingers.avgAge }})</span>
          <RatingStars :skill="stats.wingers.avgSkill" :settings="settings" />
        </div>
        <div class="stat-row">
          <span class="stat-label">Top 4 Center Skill:</span>
          <strong class="stat-value">{{ stats.centers.avgSkill }}</strong>
          <span class="stat-age">(Age: {{ stats.centers.avgAge }})</span>
          <RatingStars :skill="stats.centers.avgSkill" :settings="settings" />
        </div>
        <div class="stat-row">
          <span class="stat-label">Top 2 Goalie Skill:</span>
          <strong class="stat-value">{{ stats.goalies.avgSkill }}</strong>
          <span class="stat-age">(Age: {{ stats.goalies.avgAge }})</span>
          <RatingStars :skill="stats.goalies.avgSkill" :settings="settings" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-container {
  margin-top: 20px;
  padding: 15px;
}

h3 {
  margin-top: 0;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.stats-grid {
  display: flex;
  gap: 40px;
  flex-wrap: wrap;
}

.stat-group h4 {
  margin-bottom: 10px;
  color: #666;
}

.stat-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.stat-label {
  min-width: 140px;
}

.stat-value {
  min-width: 40px;
  text-align: right;
  margin-right: 15px;
}

.stat-age {
  min-width: 80px;
  margin-right: 10px;
}

.general-label {
  margin-right: 10px;
  min-width: 60px;
}

.general-value {
  margin-right: 15px;
}
</style>
