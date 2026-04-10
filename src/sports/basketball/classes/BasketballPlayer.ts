import { BaseInfo, BasePlayer } from "@/classes/BasePlayer";
import { PlayerCalculationProfile } from "@/classes/playerProfile";
import { basketballPlayerProfile } from "@/sports/basketball/playerProfile";
import { BasketballPositionSetting } from "@/types/Position";
import {
  calculateBasketballPositionTrainingQualities,
  calculateBasketballPositions,
} from "@/sports/basketball/calculations/playerCalculations";

export type BasketballPlayerInfo = BaseInfo & {
  height: number;
};

export type BasketballPositionName = "PG" | "SG" | "SF" | "PF" | "C" | "?";

export type BasketballSkills = {
  shooting: number;
  blocking: number;
  passing: number;
  technical: number;
  speed: number;
  aggression: number;
  jumping: number;
};

export type BasketballTrainingQualities = BasketballSkills;

export type BasketballPlayerPosition = {
  name: BasketballPositionName;
  baseRating: number;
  bonusRating: number;
  expBonus: number;
  ratingWithBonus: number;
  ratingWithXp: number;
};

export type BasketballPlayerTrainingQuality = {
  position: BasketballPositionName;
  baseTrainingQuality: number;
  bonusTrainingQuality: number;
  totalTrainingQuality: number;
};

export class BasketballPlayer extends BasePlayer {
  public height: number;
  public qualities: BasketballTrainingQualities | undefined;
  public override skills: BasketballSkills | undefined;
  public override trainingQualities: BasketballTrainingQualities | undefined;
  public override positions: BasketballPlayerPosition[] = [];
  public override positionTrainingQualities: BasketballPlayerTrainingQuality[] = [];

  constructor(
    baseInfo: BasketballPlayerInfo,
    updatedAt = new Date(),
    isVisible = true,
    seasonDay = 1,
    skills?: BasketballSkills,
    experience?: number,
    qualities?: BasketballTrainingQualities
  ) {
    super(
      baseInfo,
      updatedAt,
      Boolean(skills),
      isVisible,
      seasonDay,
      skills,
      experience,
      qualities
    );

    this.height = baseInfo.height;
    this.skills = skills;
    this.qualities = qualities;
    this.trainingQualities = qualities;
  }

  protected getCalculationProfile(): PlayerCalculationProfile {
    return basketballPlayerProfile;
  }

  override calculatePositions(): void {
    if (!this.skills) {
      super.calculatePositions();
      return;
    }

    this.positions = calculateBasketballPositions(
      this.skills,
      this.height,
      this.experience,
      basketballPlayerProfile
    );
  }

  override calculatePositionTrainingQualities(): void {
    if (!this.qualities) {
      super.calculatePositionTrainingQualities();
      return;
    }

    this.positionTrainingQualities = calculateBasketballPositionTrainingQualities(
      this.qualities,
      basketballPlayerProfile.positionSettings as BasketballPositionSetting[]
    );
  }
}
