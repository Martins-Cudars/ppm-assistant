<template>
  <SquadRankCard
    :name="player.name"
    :subject="subject"
    :is-member="isMember"
    :load-squad="loadSquad"
    :profile-url="profileUrl"
  />
</template>

<script setup lang="ts">
/** The hockey profile's squad-rank card: hockey's data fed to the shared card. */
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { getCurrentSquad } from "@/storage/playerCache";
import { getUserTeamId } from "@/utils/dom";
import { buildPlayerProfileUrl, extractLangFromUrl } from "@/utils/parsers";
import { getPlayerPageForLang } from "@/sports/hockey/routes";
import { RankedPlayer } from "@/sports/hockey/squadRank";
import SquadRankCard from "@/components/SquadRankCard.vue";

const props = defineProps<{
  player: HockeyPlayer;
}>();

const toRanked = (player: HockeyPlayer): RankedPlayer => {
  const best = player.getBestPosition();
  return { id: player.id, name: player.name, position: best.name, rating: best.ratingWithXp };
};

// No visible skills means no rating to rank (an unscouted opponent).
const subject = props.player.skills ? toRanked(props.player) : null;

// The live profile says which team the player is on; the cache may be stale.
const userTeamId = getUserTeamId();
const isMember = userTeamId !== "unknown" && props.player.teamId === userTeamId;

const loadSquad = async () => {
  const squad = await getCurrentSquad();
  return { players: squad.players.map(toRanked), rosterUpdatedAt: squad.rosterUpdatedAt };
};

const lang = extractLangFromUrl(window.location.pathname);
const profileUrl = (playerId: string) =>
  buildPlayerProfileUrl("hockey", lang, getPlayerPageForLang(lang), playerId);
</script>
