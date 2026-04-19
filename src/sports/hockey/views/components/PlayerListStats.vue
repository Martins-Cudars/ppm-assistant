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
  getValue: (p: HockeyPlayer) => number,
  decimals = 0
) => {
  if (items.length === 0) return decimals === 0 ? 0 : (0).toFixed(decimals);
  const sum = items.reduce((acc, p) => acc + getValue(p), 0);
  const avg = sum / items.length;
  return decimals === 0 ? Math.round(avg) : avg.toFixed(decimals);
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
    avgAge: calculateAverage(top, (p) => p.age, 1),
  };
};

const getMinMaxStats = (position: string, count: number) => {
  const filtered = props.players.filter(
    (p) => p.getBestPosition().name === position
  );

  if (filtered.length === 0) return null;

  const sorted = filtered.sort(
    (a, b) =>
      b.getBestPosition().ratingWithXp - a.getBestPosition().ratingWithXp
  );

  const topN = sorted.slice(0, count);

  const strongest = topN[0];
  const weakest = topN[topN.length - 1];

  return {
    strongest: {
      skill: strongest.getBestPosition().ratingWithXp,
      age: strongest.age,
    },
    weakest: {
      skill: weakest.getBestPosition().ratingWithXp,
      age: weakest.age,
    },
  };
};

const stats = computed(() => ({
  top22: {
    avgOr: calculateAverage(top22.value, (p) => p.overallRating),
    avgAge: calculateAverage(top22.value, (p) => p.age, 1),
  },
  top17: {
    avgOr: calculateAverage(top17.value, (p) => p.overallRating),
    avgAge: calculateAverage(top17.value, (p) => p.age, 1),
  },
  defenders: getPositionalStats("D", 8),
  wingers: getPositionalStats("W", 8),
  centers: getPositionalStats("C", 4),
  goalies: getPositionalStats("G", 2),
  extremes: {
    defenders: getMinMaxStats("D", 8),
    wingers: getMinMaxStats("W", 8),
    centers: getMinMaxStats("C", 4),
    goalies: getMinMaxStats("G", 2),
  },
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
          <span class="stat-label">Top 8 D Skill:</span>
          <strong class="stat-value">{{ stats.defenders.avgSkill }}</strong>
          <span class="stat-age">(Age: {{ stats.defenders.avgAge }})</span>
          <RatingStars :skill="stats.defenders.avgSkill" :settings="settings" />
        </div>
        <div class="stat-row">
          <span class="stat-label">Top 8 W Skill:</span>
          <strong class="stat-value">{{ stats.wingers.avgSkill }}</strong>
          <span class="stat-age">(Age: {{ stats.wingers.avgAge }})</span>
          <RatingStars :skill="stats.wingers.avgSkill" :settings="settings" />
        </div>
        <div class="stat-row">
          <span class="stat-label">Top 4 C Skill:</span>
          <strong class="stat-value">{{ stats.centers.avgSkill }}</strong>
          <span class="stat-age">(Age: {{ stats.centers.avgAge }})</span>
          <RatingStars :skill="stats.centers.avgSkill" :settings="settings" />
        </div>
        <div class="stat-row">
          <span class="stat-label">Top 2 G Skill:</span>
          <strong class="stat-value">{{ stats.goalies.avgSkill }}</strong>
          <span class="stat-age">(Age: {{ stats.goalies.avgAge }})</span>
          <RatingStars :skill="stats.goalies.avgSkill" :settings="settings" />
        </div>
      </div>

      <div class="stat-group">
        <h4>Extremes (Strongest / Weakest)</h4>

        <!-- Defenders -->
        <div class="stat-row" v-if="stats.extremes.defenders">
          <span class="stat-label">Strongest D:</span>
          <strong class="stat-value">{{
            stats.extremes.defenders.strongest.skill
          }}</strong>
          <span class="stat-age"
            >(Age: {{ stats.extremes.defenders.strongest.age }})</span
          >
          <RatingStars
            :skill="stats.extremes.defenders.strongest.skill"
            :settings="settings"
          />
        </div>
        <div class="stat-row" v-if="stats.extremes.defenders">
          <span class="stat-label">Weakest D:</span>
          <strong class="stat-value">{{
            stats.extremes.defenders.weakest.skill
          }}</strong>
          <span class="stat-age"
            >(Age: {{ stats.extremes.defenders.weakest.age }})</span
          >
          <RatingStars
            :skill="stats.extremes.defenders.weakest.skill"
            :settings="settings"
          />
        </div>

        <!-- Wingers -->
        <div class="stat-row" v-if="stats.extremes.wingers">
          <span class="stat-label">Strongest W:</span>
          <strong class="stat-value">{{
            stats.extremes.wingers.strongest.skill
          }}</strong>
          <span class="stat-age"
            >(Age: {{ stats.extremes.wingers.strongest.age }})</span
          >
          <RatingStars
            :skill="stats.extremes.wingers.strongest.skill"
            :settings="settings"
          />
        </div>
        <div class="stat-row" v-if="stats.extremes.wingers">
          <span class="stat-label">Weakest W:</span>
          <strong class="stat-value">{{
            stats.extremes.wingers.weakest.skill
          }}</strong>
          <span class="stat-age"
            >(Age: {{ stats.extremes.wingers.weakest.age }})</span
          >
          <RatingStars
            :skill="stats.extremes.wingers.weakest.skill"
            :settings="settings"
          />
        </div>

        <!-- Centers -->
        <div class="stat-row" v-if="stats.extremes.centers">
          <span class="stat-label">Strongest C:</span>
          <strong class="stat-value">{{
            stats.extremes.centers.strongest.skill
          }}</strong>
          <span class="stat-age"
            >(Age: {{ stats.extremes.centers.strongest.age }})</span
          >
          <RatingStars
            :skill="stats.extremes.centers.strongest.skill"
            :settings="settings"
          />
        </div>
        <div class="stat-row" v-if="stats.extremes.centers">
          <span class="stat-label">Weakest C:</span>
          <strong class="stat-value">{{
            stats.extremes.centers.weakest.skill
          }}</strong>
          <span class="stat-age"
            >(Age: {{ stats.extremes.centers.weakest.age }})</span
          >
          <RatingStars
            :skill="stats.extremes.centers.weakest.skill"
            :settings="settings"
          />
        </div>

        <!-- Goalies -->
        <div class="stat-row" v-if="stats.extremes.goalies">
          <span class="stat-label">Strongest G:</span>
          <strong class="stat-value">{{
            stats.extremes.goalies.strongest.skill
          }}</strong>
          <span class="stat-age"
            >(Age: {{ stats.extremes.goalies.strongest.age }})</span
          >
          <RatingStars
            :skill="stats.extremes.goalies.strongest.skill"
            :settings="settings"
          />
        </div>
        <div class="stat-row" v-if="stats.extremes.goalies">
          <span class="stat-label">Weakest G:</span>
          <strong class="stat-value">{{
            stats.extremes.goalies.weakest.skill
          }}</strong>
          <span class="stat-age"
            >(Age: {{ stats.extremes.goalies.weakest.age }})</span
          >
          <RatingStars
            :skill="stats.extremes.goalies.weakest.skill"
            :settings="settings"
          />
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
  display: grid;
  grid-template-columns: repeat(3, auto);
  gap: 20px;
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
  min-width: 110px;
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
