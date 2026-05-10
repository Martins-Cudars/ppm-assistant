import { SoccerPlayer } from "@/sports/soccer/classes/SoccerPlayer";

export function getSoccerRelativeSkill(player: SoccerPlayer): number {
  return player.getBestPosition().ratingWithXp;
}
