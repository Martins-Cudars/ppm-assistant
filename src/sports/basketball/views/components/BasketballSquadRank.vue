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
/**
 * The basketball profile's squad-rank card: basketball's cached squad fed to
 * the shared card. Ranked by best-position rating with XP, height included.
 */
import { BasketballPlayer } from "@/sports/basketball/classes/BasketballPlayer";
import {
  StoredBasketballPlayer,
  deserializeBasketballPlayer,
  normalizePlayerId,
} from "@/sports/basketball/capture";
import { getCurrentSquadStored } from "@/storage/playerCache";
import { getPlayerTeamId, getUserTeamId } from "@/utils/dom";
import { buildPlayerProfileUrl, extractLangFromUrl } from "@/utils/parsers";
import { getLocalizedPageForLang } from "@/sports/routeDispatch";
import routes from "@/sports/basketball/routes";
import { RankedPlayer } from "@/sports/hockey/squadRank";
import SquadRankCard from "@/components/SquadRankCard.vue";

const props = defineProps<{
  player: BasketballPlayer;
}>();

const toRanked = (player: BasketballPlayer): RankedPlayer => {
  const best = player.getBestPosition();
  return {
    id: normalizePlayerId(player.id) ?? player.id,
    name: player.name,
    position: best.name,
    rating: best.ratingWithXp,
  };
};

const subject = props.player.skills ? toRanked(props.player) : null;

// The profile parser doesn't set a team id, so read it from the page, as the
// capture does.
const userTeamId = getUserTeamId();
const isMember = userTeamId !== "unknown" && getPlayerTeamId() === userTeamId;

const loadSquad = async () => {
  const squad = await getCurrentSquadStored<StoredBasketballPlayer>("basketball");
  return {
    players: squad.players.map((stored) => toRanked(deserializeBasketballPlayer(stored))),
    rosterUpdatedAt: squad.rosterUpdatedAt,
  };
};

const lang = extractLangFromUrl(window.location.pathname);
const profileUrl = (playerId: string) =>
  buildPlayerProfileUrl(
    "basketball",
    lang,
    getLocalizedPageForLang(routes.playerProfile, lang, "player-profile.html"),
    playerId
  );
</script>
