import { BasePlayer, BaseInfo } from "./BasePlayer";

export type HockeyPlayerInfo = BaseInfo & {
  preferedSide: "L" | "R" | "U";
};

export type HockeyPlayerPosition = {
  name: "D" | "W" | "C" | "G" | "?";
  rating: number;
  ratingWithXp: number;
};

export type HockeySkills = {
  goalie: number;
  defence: number;
  offence: number;
  shooting: number;
  passing: number;
  technical: number;
  aggression: number;
};

export class HockeyPlayer extends BasePlayer {
  private preferedSide: "L" | "R" | "U";
  private positions: HockeyPlayerPosition[];

  constructor(
    baseInfo: HockeyPlayerInfo,
    updatedAt = new Date(),
    isScouted = false,
    isVisible = false,
    skills: HockeySkills | undefined = undefined,
    experience: number | undefined = undefined,
    trainingQualities: Record<string, number> | undefined = undefined
  ) {
    super(
      baseInfo,
      updatedAt,
      isScouted,
      isVisible,
      skills,
      experience,
      trainingQualities
    );
    this.preferedSide = baseInfo.preferedSide;
  }

  override calculatePositions() {
    console.log(`skills visible ${this.isVisible}`);
    if (this.isVisible && this.skills) {
      this.positions = [
        this.createPosition(
          "D",
          Math.floor(
            Math.min(
              this.skills.defence,
              this.skills.passing * 2,
              this.skills.aggression * 2
            ) +
              this.skills.shooting * 0.15 +
              this.skills.technical * 0.25 +
              this.skills.offence * 0.1
          )
        ),
        this.createPosition(
          "W",
          Math.floor(
            Math.min(
              this.skills.offence,
              this.skills.technical * 2,
              this.skills.aggression * 2
            ) +
              this.skills.shooting * 0.25 +
              this.skills.defence * 0.1
          )
        ),
        this.createPosition(
          "C",
          Math.floor(
            Math.min(
              this.skills.offence,
              this.skills.passing * 2,
              this.skills.technical * 2
            ) +
              this.skills.shooting * 0.25 +
              this.skills.defence * 0.1
          )
        ),
        this.createPosition(
          "G",
          Math.min(
            this.skills.goalie,
            this.skills.passing * 2,
            this.skills.technical * 2
          )
        ),
      ];
    } else {
      const unknownRating = this.calculateUnknownRating();
      this.positions = [this.createPosition("?", unknownRating)];
    }
  }

  /** Utilities */

  private createPosition(
    name: HockeyPlayerPosition["name"],
    baseRating: number
  ): HockeyPlayerPosition {
    return {
      name,
      rating: Math.floor(baseRating),
      ratingWithXp: this.calculateRatingWithXp(baseRating),
    };
  }

  private calculateUnknownRating(): number {
    return (this.overalRating - 100) / 2;
  }

  private calculateRatingWithXp(rating: number): number {
    return Math.floor(rating * (1 + this.experience / 500));
  }
}
