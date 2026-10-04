<template>
  <SquadRankCard
    :name="player.name"
    :subject="subject"
    :is-member="isMember"
    :load-squad="loadSquad"
    :profile-url="profileUrl"
    :position-nouns="SOCCER_POSITION_NOUN"
  />
</template>

<script setup lang="ts">
/**
 * The soccer profile's squad-rank card: soccer's cached squad fed to the
 * shared card, ranked by best-position rating with XP.
 */
import { SoccerPlayer } from "@/sports/soccer/classes/SoccerPlayer";
import { StoredSoccerPlayer, deserializeSoccerPlayer } from "@/sports/soccer/capture";
import { normalizePlayerId } from "@/base/captureUtils";
import { getCurrentSquadStored } from "@/storage/playerCache";
import { getPlayerTeamId, getUserTeamId } from "@/utils/dom";
import { buildPlayerProfileUrl, extractLangFromUrl } from "@/utils/parsers";
import { getSoccerPlayerPageForLang } from "@/sports/soccer/routes";
import { RankedPlayer } from "@/sports/hockey/squadRank";
import SquadRankCard from "@/components/SquadRankCard.vue";

const props = defineProps<{
  player: SoccerPlayer;
}>();

// Soccer's own nouns: "SF" here is a side forward, not basketball's small forward.
const SOCCER_POSITION_NOUN: Record<string, string> = {
  GK: "goalkeeper",
  SD: "side defender",
  CD: "centre-back",
  SM: "side midfielder",
  CM: "central midfielder",
  SF: "side forward",
  CF: "centre forward",
};

const toRanked = (player: SoccerPlayer): RankedPlayer => {
  const best = player.getBestPosition();
  return {
    id: normalizePlayerId(player.id) ?? player.id,
    name: player.name,
    position: best.name,
    rating: best.ratingWithXp,
  };
};

const subject = props.player.skills ? toRanked(props.player) : null;

const userTeamId = getUserTeamId();
const isMember = userTeamId !== "unknown" && getPlayerTeamId() === userTeamId;

const loadSquad = async () => {
  const squad = await getCurrentSquadStored<StoredSoccerPlayer>("soccer");
  return {
    players: squad.players.map((stored) => toRanked(deserializeSoccerPlayer(stored))),
    rosterUpdatedAt: squad.rosterUpdatedAt,
  };
};

const lang = extractLangFromUrl(window.location.pathname);
const profileUrl = (playerId: string) =>
  buildPlayerProfileUrl("soccer", lang, getSoccerPlayerPageForLang(lang), playerId);
</script>
