import { BaseInfo, BasePlayer } from "@/classes/BasePlayer";
import { calculateSkillWithExp } from "@/base/calculations";
import { playerGrowthPrediction, positionSettings } from "@/sports/soccer/settings";

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

type TrainingQuality = {
  weight: number;
  value: number;
};

export type SoccerPlayerTrainingQuality = {
  position: SoccerPlayerPositionName;
  baseTrainingQuality: number;
  bonusTrainingQuality: number;
  totalTrainingQuality: number;
};

export class SoccerPlayer extends BasePlayer {
  private static readonly DAYS_PER_SEASON = 112;
  private static readonly BONUS_CAP_RATIO = 0.35;

  public override skills?: SoccerSkills;
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

  override calculatePositions() {
    if (!this.skills) {
      const unknownRating = this.calculateUnknownRating();
      this.positions = [this.createPosition("?", unknownRating)];
      return;
    }

    this.positions = positionSettings.map((position) => {
      const baseRating = Math.min(
        ...Object.entries(position.ratios).map(([skillName, ratio]) =>
          Math.round(this.skills![skillName as keyof SoccerSkills] / ratio)
        )
      );

      const bonusRating = position.bonus
        ? Math.floor(
            Object.entries(position.bonus).reduce(
              (sum, [skillName, ratio]) =>
                sum + this.skills![skillName as keyof SoccerSkills] * ratio,
              0
            )
          )
        : 0;

      return this.createPosition(position.name, baseRating, bonusRating);
    });
  }

  override calculatePositionTrainingQualities() {
    if (!this.trainingQualities) {
      this.positionTrainingQualities = [
        this.createPositionTrainingQuality(
          "?",
          [{ weight: 1, value: this.averageTrainingRatio }],
          [{ weight: 1, value: this.averageTrainingRatio }]
        ),
      ];
      return;
    }

    this.positionTrainingQualities = positionSettings.map((position) => {
      const baseTrainingQualities = Object.entries(position.ratios).map(
        ([skillName, weight]) => ({
          weight,
          value: this.trainingQualities![skillName],
        })
      );

      const bonusTrainingQualities = position.bonus
        ? Object.entries(position.bonus).map(([skillName, weight]) => ({
            weight,
            value: this.trainingQualities![skillName],
          }))
        : undefined;

      return this.createPositionTrainingQuality(
        position.name,
        baseTrainingQualities,
        bonusTrainingQualities
      );
    });
  }

  override getMaxSkillForAge(): number {
    const predictionByAge = playerGrowthPrediction.find(
      (row) => row.age === this.age
    );

    if (!predictionByAge) {
      return 0;
    }

    const nextPrediction = playerGrowthPrediction.find(
      (row) => row.age === this.age + 1
    );

    let skill = predictionByAge.skill;
    let exp = predictionByAge.exp;

    if (nextPrediction) {
      const seasonProgress = this.seasonDay / SoccerPlayer.DAYS_PER_SEASON;
      skill += (nextPrediction.skill - predictionByAge.skill) * seasonProgress;
      exp += (nextPrediction.exp - predictionByAge.exp) * seasonProgress;
    }

    return calculateSkillWithExp(Math.round(skill), Math.round(exp));
  }

  getPositionTrainingQuality(
    position: SoccerPlayerPositionName
  ): SoccerPlayerTrainingQuality | undefined {
    return this.positionTrainingQualities.find((item) => item.position === position);
  }

  private createPosition(
    name: SoccerPlayerPositionName,
    baseRating: number,
    bonusRating = 0
  ): SoccerPlayerPosition {
    const cappedBonus = Math.floor(
      Math.min(baseRating * SoccerPlayer.BONUS_CAP_RATIO, bonusRating)
    );
    const ratingWithBonus = baseRating + cappedBonus;
    const ratingWithXp = calculateSkillWithExp(ratingWithBonus, this.experience);

    return {
      name,
      baseRating,
      bonusRating: cappedBonus,
      expBonus: ratingWithXp - ratingWithBonus,
      ratingWithBonus,
      ratingWithXp,
    };
  }

  private createPositionTrainingQuality(
    position: SoccerPlayerPositionName,
    baseTrainingQualities: TrainingQuality[],
    bonusTrainingQualities?: TrainingQuality[]
  ): SoccerPlayerTrainingQuality {
    const baseTrainingQualitiesTotalWeight = baseTrainingQualities.reduce(
      (acc, curr) => acc + curr.weight,
      0
    );

    const bonusTrainingQualitiesTotalWeight = bonusTrainingQualities
      ? bonusTrainingQualities.reduce((acc, curr) => acc + curr.weight, 0)
      : 0;

    const baseTrainingQuality = Math.floor(
      baseTrainingQualities.reduce(
        (acc, curr) => acc + curr.value * curr.weight,
        0
      ) / baseTrainingQualitiesTotalWeight
    );

    const bonusTrainingQuality = Math.floor(
      bonusTrainingQualities && bonusTrainingQualitiesTotalWeight > 0
        ? bonusTrainingQualities.reduce(
            (acc, curr) => acc + curr.value * curr.weight,
            0
          ) / bonusTrainingQualitiesTotalWeight
        : 0
    );

    const totalTrainingQuality = Math.floor(
      (baseTrainingQuality * baseTrainingQualitiesTotalWeight +
        bonusTrainingQuality * bonusTrainingQualitiesTotalWeight) /
        (baseTrainingQualitiesTotalWeight + bonusTrainingQualitiesTotalWeight)
    );

    return {
      position,
      baseTrainingQuality,
      bonusTrainingQuality,
      totalTrainingQuality,
    };
  }

  private calculateUnknownRating(): number {
    return (this.overallRating - 100) / 2;
  }
}
