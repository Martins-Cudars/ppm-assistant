import { SoccerPlayer } from "@/sports/soccer/classes/SoccerPlayer";

const soccerGoalieRelativeSkillFactor = 1.25;

export function getSoccerRelativeSkill(player: SoccerPlayer): number {
  const bestPosition = player.getBestPosition();

  return bestPosition.name === "GK"
    ? bestPosition.ratingWithXp / soccerGoalieRelativeSkillFactor
    : bestPosition.ratingWithXp;
}
