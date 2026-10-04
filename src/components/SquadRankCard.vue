<template>
  <div v-if="result" class="player-profile player-profile--squad-rank">
    <div class="squad-rank__badge">{{ ordinal(result.rank) }}</div>
    <div class="squad-rank__text">{{ sentence }}</div>

    <!-- One grid, not a row of inline text per player: arrow, rank, name,
         rating and gap each keep their own column however long a name is. -->
    <div v-if="result.rows.length > 1" class="squad-rank__table">
      <template v-for="row in result.rows" :key="row.id">
        <span :class="cellClass(row)">{{ ARROW[row.side] }}</span>
        <span :class="[cellClass(row), 'squad-rank__num']">{{ ordinal(row.rank) }}</span>
        <span :class="[cellClass(row), 'squad-rank__name']" :title="row.name">
          <a v-if="row.side !== 'subject'" :href="profileUrl(row.id)">{{ row.name }}</a>
          <template v-else>{{ row.name }}</template>
        </span>
        <span :class="[cellClass(row), 'squad-rank__num']">{{ row.rating }}</span>
        <span :class="[cellClass(row), 'squad-rank__num']">
          {{ row.side === "subject" ? "" : signed(row.gap) }}
        </span>
      </template>
    </div>

    <div class="squad-rank__footnote">{{ footnote }}</div>
  </div>
</template>

<script setup lang="ts">
/**
 * "Name is the 5th best winger on the team" - where a player stands at his
 * best position within the logged-in team's squad, with the standings around
 * him. Sport-agnostic: each sport's sidebar supplies the ranked subject, how
 * to load its squad, and how to link a profile.
 */
import { computed, onMounted, ref } from "vue";
import {
  POSITION_NOUN,
  RankedPlayer,
  SquadRank,
  StandingRow,
  ordinal,
  rankInSquad,
} from "@/sports/hockey/squadRank";

const props = withDefaults(
  defineProps<{
  name: string;
  /** Null when the player has no position rating to rank - the card stays hidden. */
  subject: RankedPlayer | null;
  /** On the logged-in team - "is" rather than "would be". */
  isMember: boolean;
  loadSquad: () => Promise<{ players: RankedPlayer[]; rosterUpdatedAt: string | null }>;
  profileUrl: (playerId: string) => string;
  /**
   * Position code -> noun, e.g. SD -> "side defender". Per sport, since codes
   * clash: soccer's SF is a side forward, basketball's a small forward.
   * Positions missing from it aren't ranked.
   */
  positionNouns?: Record<string, string>;
}>(),
  { positionNouns: () => POSITION_NOUN }
);

const result = ref<SquadRank | null>(null);
const rosterUpdatedAt = ref<string | null>(null);

// A player cached without calculated positions reads as "?" with a zero
// rating. Rank only real positions.
const isRankable = (player: RankedPlayer) => player.position in props.positionNouns;

onMounted(async () => {
  const subject = props.subject;
  if (!subject || !isRankable(subject)) return;

  const squad = await props.loadSquad();
  const rankable = squad.players.filter(isRankable);
  if (rankable.length === 0) return;

  rosterUpdatedAt.value = squad.rosterUpdatedAt;
  result.value = rankInSquad(subject, rankable);
});

const sentence = computed(() => {
  const rank = result.value;
  if (!rank) return "";

  const verb = props.isMember ? "is" : "would be";
  const noun = props.positionNouns[rank.position] ?? rank.position;

  if (rank.total === 1) return `${props.name} ${verb} the only ${noun} on the team`;
  const place = rank.rank === 1 ? "the best" : `the ${ordinal(rank.rank)} best`;
  return `${props.name} ${verb} ${place} ${noun} on the team (of ${rank.total})`;
});

const footnote = computed(() => {
  if (!rosterUpdatedAt.value) return "Open the squad overview to refresh the roster";

  const days = Math.floor((Date.now() - Date.parse(rosterUpdatedAt.value)) / 86_400_000);
  const when = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return `Squad as of the overview, ${when}`;
});

const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value)}`;

const ARROW: Record<StandingRow["side"], string> = { above: "↑", subject: "•", below: "↓" };

// Each grid cell is its own element, so the subject's highlight goes on every
// cell of its row rather than on a row wrapper the grid doesn't have.
const cellClass = (row: StandingRow) => ({ "squad-rank__subject": row.side === "subject" });
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

.squad-rank__table {
  display: grid;
  /* arrow | rank | name (takes the slack, truncates) | rating | gap */
  grid-template-columns: auto auto minmax(0, 1fr) auto auto;
  /* Spacing lives in cell padding, not column-gap, so the subject row's
     highlight runs unbroken across its cells. */
  row-gap: 2px;
  width: 100%;
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.6;
  color: #666;
}

.squad-rank__table > span {
  padding: 0 3px;
}

.squad-rank__num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.squad-rank__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.squad-rank__name a {
  color: inherit;
}

.squad-rank__subject {
  color: #222;
  font-weight: bold;
  background: #eef3f7;
}

.squad-rank__footnote {
  margin-top: 8px;
  font-size: 11px;
  color: #999;
  text-align: center;
}
</style>
