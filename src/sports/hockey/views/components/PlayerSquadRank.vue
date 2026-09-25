<template>
  <div v-if="result" class="player-profile player-profile--squad-rank">
    <div class="squad-rank__badge">{{ ordinal(result.rank) }}</div>
    <div class="squad-rank__text">{{ sentence }}</div>

    <div v-if="result.above || result.below" class="squad-rank__neighbours">
      <div v-if="result.above">
        ↑ {{ ordinal(result.above.rank) }}
        <a :href="profileUrl(result.above.id)">{{ result.above.name }}</a>
        {{ result.above.rating }} ({{ signed(result.above.gap) }})
      </div>
      <div v-if="result.below">
        ↓ {{ ordinal(result.below.rank) }}
        <a :href="profileUrl(result.below.id)">{{ result.below.name }}</a>
        {{ result.below.rating }} ({{ signed(result.below.gap) }})
      </div>
    </div>

    <div class="squad-rank__footnote">{{ footnote }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { getCurrentSquad } from "@/storage/playerCache";
import { getUserTeamId } from "@/utils/dom";
import { buildPlayerProfileUrl, extractLangFromUrl } from "@/utils/parsers";
import { getPlayerPageForLang } from "@/sports/hockey/routes";
import {
  POSITION_NOUN,
  RankedPlayer,
  SquadRank,
  ordinal,
  rankInSquad,
} from "@/sports/hockey/squadRank";

const props = defineProps<{
  player: HockeyPlayer;
}>();

const result = ref<SquadRank | null>(null);
const rosterUpdatedAt = ref<string | null>(null);

// The live profile says which team the player is on; the cache may be stale.
const isMember = computed(() => {
  const userTeamId = getUserTeamId();
  return userTeamId !== "unknown" && props.player.teamId === userTeamId;
});

const toRanked = (player: HockeyPlayer): RankedPlayer => {
  const best = player.getBestPosition();
  return { id: player.id, name: player.name, position: best.name, rating: best.ratingWithXp };
};

// Skills alone aren't enough: a player whose attributes weren't visible when
// cached can carry skills but no calculated positions, and getBestPosition()
// then returns "?" with a zero rating. Rank only real positions.
const isRankable = (player: RankedPlayer) => player.position in POSITION_NOUN;

onMounted(async () => {
  // No position rating means nothing to rank - e.g. an unscouted opponent.
  // Stay hidden rather than rank a zero.
  const subject = toRanked(props.player);
  if (!props.player.skills || !isRankable(subject)) return;

  const squad = await getCurrentSquad();
  const rankable = squad.players.map(toRanked).filter(isRankable);
  if (rankable.length === 0) return;

  rosterUpdatedAt.value = squad.rosterUpdatedAt;
  result.value = rankInSquad(subject, rankable);
});

const sentence = computed(() => {
  const rank = result.value;
  if (!rank) return "";

  const verb = isMember.value ? "is" : "would be";
  const noun = POSITION_NOUN[rank.position] ?? rank.position;

  if (rank.total === 1) return `${props.player.name} ${verb} the only ${noun} on the team`;
  const place = rank.rank === 1 ? "the best" : `the ${ordinal(rank.rank)} best`;
  return `${props.player.name} ${verb} ${place} ${noun} on the team (of ${rank.total})`;
});

const footnote = computed(() => {
  if (!rosterUpdatedAt.value) return "Open the squad overview to refresh the roster";

  const days = Math.floor((Date.now() - Date.parse(rosterUpdatedAt.value)) / 86_400_000);
  const when = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return `Squad as of the overview, ${when}`;
});

const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value)}`;

const lang = extractLangFromUrl(window.location.pathname);
const profileUrl = (playerId: string) =>
  buildPlayerProfileUrl("hockey", lang, getPlayerPageForLang(lang), playerId);
</script>

<style scoped>
.player-profile {
  background: #fff;
  border: 1px solid #c9c9c9;
  border-radius: 5px;
  padding: 10px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.squad-rank__badge {
  padding: 5px 10px;
  border-radius: 5px;
  background-color: #2c5f7c;
  color: #fff;
  font-weight: bold;
  margin-bottom: 5px;
}

.squad-rank__text {
  text-align: center;
  font-size: 14px;
}

.squad-rank__neighbours {
  margin-top: 10px;
  font-size: 12px;
  color: #666;
  text-align: center;
  line-height: 1.6;
}

.squad-rank__neighbours a {
  color: inherit;
  font-weight: bold;
}

.squad-rank__footnote {
  margin-top: 8px;
  font-size: 11px;
  color: #999;
  text-align: center;
}
</style>
