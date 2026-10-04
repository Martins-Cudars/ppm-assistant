<script setup lang="ts">
/**
 * The Player Report page: one tab per sport. Opens on the sport given in the
 * URL (?sport=basketball, from that sport's squad overview), otherwise on the
 * last tab used. Remembering it is a per-viewer convenience, so storage
 * failures just fall back to hockey.
 */
import { ref, watch } from "vue";
import { SPORTS, Sport } from "@/types/Sport";
import PlayerReport from "@/sports/hockey/views/components/PlayerReport.vue";
import BasketballReport from "@/sports/basketball/views/components/BasketballReport.vue";
import SoccerReport from "@/sports/soccer/views/components/SoccerReport.vue";

const SPORT_KEY = "ppm-assistant:report:sport";
const LABEL: Record<Sport, string> = { hockey: "Hockey", basketball: "Basketball", soccer: "Soccer" };

const isSport = (value: string | null): value is Sport =>
  value !== null && (SPORTS as readonly string[]).includes(value);

const initialSport = (): Sport => {
  const fromUrl = new URLSearchParams(window.location.search).get("sport");
  if (isSport(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(SPORT_KEY);
    if (isSport(saved)) return saved;
  } catch {
    // Fall through to the default.
  }
  return "hockey";
};

const sport = ref<Sport>(initialSport());
watch(sport, (value) => {
  try {
    localStorage.setItem(SPORT_KEY, value);
  } catch {
    // Not remembered this time.
  }
});
</script>

<template>
  <div class="report-shell">
    <nav class="sport-tabs" aria-label="Sport">
      <button
        v-for="s in SPORTS"
        :key="s"
        :class="{ active: sport === s }"
        :aria-pressed="sport === s"
        @click="sport = s"
      >
        {{ LABEL[s] }}
      </button>
    </nav>
    <!-- Mounted per tab rather than hidden, so each report loads its own data
         only when shown. -->
    <PlayerReport v-if="sport === 'hockey'" />
    <BasketballReport v-else-if="sport === 'basketball'" />
    <SoccerReport v-else />
  </div>
</template>

<style scoped>
.sport-tabs {
  display: flex;
  gap: 4px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 20px 0;
}

.sport-tabs button {
  padding: 8px 18px;
  border: 1px solid #ddd;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  background: #eef1f5;
  color: #57606a;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.sport-tabs button.active {
  background: #fff;
  color: #24292f;
}
</style>
