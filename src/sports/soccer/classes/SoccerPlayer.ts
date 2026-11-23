import { BaseInfo, BasePlayer } from "@/classes/BasePlayer";
import { PlayerCalculationProfile } from "@/classes/playerProfile";
import { soccerPlayerProfile } from "@/sports/soccer/playerProfile";

export type SoccerPlayerInfo = BaseInfo;

export type SoccerPlayerPositionName =
  | "GK"
  | "SD"
  | "CD"
  | "SM"
  | "CM"
  | "DM"
  | "SF"
  | "CF"
  | "?";

export type SoccerSkills = {
  goalie: number;
  defence: number;
  midfield: number;
  offence: number;
  shooting: number;
  passing: number;
  technical: number;
  speed: number;
  heading: number;
};

export type SoccerPlayerPosition = {
  name: SoccerPlayerPositionName;
  baseRating: number;
  bonusRating: number;
  expBonus: number;
  ratingWithBonus: number;
  ratingWithXp: number;
};

export type SoccerPlayerTrainingQuality = {
  position: SoccerPlayerPositionName;
  baseTrainingQuality: number;
  bonusTrainingQuality: number;
  totalTrainingQuality: number;
};

export class SoccerPlayer extends BasePlayer {
  public override skills: SoccerSkills | undefined;
  public override positions: SoccerPlayerPosition[] = [];
  public override positionTrainingQualities: SoccerPlayerTrainingQuality[] = [];

  constructor(
    baseInfo: SoccerPlayerInfo,
    updatedAt = new Date(),
    isScouted = false,
    isVisible = false,
    seasonDay = 1,
    skills?: SoccerSkills,
    experience?: number,
    trainingQualities?: Record<string, number>,
    injuryDays = 0
  ) {
    super(
      baseInfo,
      updatedAt,
      isScouted,
      isVisible,
      seasonDay,
      skills,
      experience,
      trainingQualities,
      injuryDays
    );

    this.skills = skills;
  }

  protected getCalculationProfile(): PlayerCalculationProfile {
    return soccerPlayerProfile;
  }

  getPositionTrainingQuality(
    position: SoccerPlayerPositionName
  ): SoccerPlayerTrainingQuality | undefined {
    return this.positionTrainingQualities.find((item) => item.position === position);
  }
}
