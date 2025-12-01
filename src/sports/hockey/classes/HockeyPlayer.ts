import { BasePlayer, BaseInfo } from "@/classes/BasePlayer";

export type HockeyPlayerInfo = BaseInfo & {
  preferredSide: "L" | "R" | "U";
};

export type HockeyPlayerPosition = {
  name: "D" | "W" | "C" | "G" | "?";
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

export type HockeyPlayerTrainingQuality = {
  position: HockeyPlayerPosition["name"];
  baseTrainingQuality: number;
  bonusTrainingQuality: number;
  totalTrainingQuality: number;
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
  private static readonly BONUS_CAP_RATIO = 0.25;
  private static readonly EXPERIENCE_DIVISOR = 500;

  public preferredSide: "L" | "R" | "U"; // Fixed typo
  public positions: HockeyPlayerPosition[] = []; // Initialize arrays
  public positionTrainingQualities: HockeyPlayerTrainingQuality[] = []; // Initialize arrays

  constructor(
    baseInfo: HockeyPlayerInfo,
    updatedAt = new Date(),
    isScouted = false,
    isVisible = false,
    skills?: HockeySkills, // Use optional parameter syntax
    experience?: number, // Use optional parameter syntax
    trainingQualities?: Record<string, number> // Use optional parameter syntax
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
    this.preferredSide = baseInfo.preferredSide;
  }

  override calculatePositions() {
    if (!this.isVisible || !this.skills) {
      const unknownRating = this.calculateUnknownRating();
      this.positions = [this.createPosition("?", unknownRating, 0)];
      return;
    }

    this.positions = [
      this.createPosition(
        "D",
        Math.floor(
          Math.min(
            this.skills.defence,
            this.skills.passing * 2,
            this.skills.aggression * 2
          )
        ),
        Math.floor(
          this.skills.shooting * 0.15 +
            this.skills.technical * 0.15 +
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
          )
        ),
        Math.floor(this.skills.shooting * 0.35 + this.skills.defence * 0.1)
      ),
      this.createPosition(
        "C",
        Math.floor(
          Math.min(
            this.skills.offence,
            this.skills.passing * 2,
            this.skills.technical * 2
          )
        ),
        Math.floor(this.skills.shooting * 0.35 + this.skills.defence * 0.1)
      ),
      this.createPosition(
        "G",
        Math.min(
          this.skills.goalie,
          this.skills.passing * 2,
          this.skills.technical * 2
        ),
        0
      ),
    ];
  }

  override calculatePositionTrainingQualities() {
    if (!this.isVisible || !this.trainingQualities) {
      this.positionTrainingQualities = [
        this.createPositionTrainingQuality(
          "?",
          [
            {
              weight: 1,
              value: this.averageTrainingRatio,
            },
          ],
          [
            {
              weight: 1,
              value: this.averageTrainingRatio,
            },
          ]
        ),
      ];
      return;
    }

    this.positionTrainingQualities = [
      this.createPositionTrainingQuality(
        "D",

        [
          { weight: 100, value: this.trainingQualities.defence },
          { weight: 50, value: this.trainingQualities.passing },
          { weight: 50, value: this.trainingQualities.aggression },
        ],
        [
          { weight: 5, value: this.trainingQualities.shooting },
          { weight: 25, value: this.trainingQualities.technical },
        ]
      ),
      this.createPositionTrainingQuality(
        "W",
        [
          { weight: 100, value: this.trainingQualities.offence },
          { weight: 50, value: this.trainingQualities.technical },
          { weight: 50, value: this.trainingQualities.aggression },
        ],
        [{ weight: 75, value: this.trainingQualities.shooting }]
      ),
      this.createPositionTrainingQuality(
        "C",
        [
          { weight: 100, value: this.trainingQualities.offence },
          { weight: 50, value: this.trainingQualities.passing },
          { weight: 50, value: this.trainingQualities.technical },
        ],
        [{ weight: 75, value: this.trainingQualities.shooting }]
      ),
      this.createPositionTrainingQuality("G", [
        { weight: 100, value: this.trainingQualities.goalie },
        { weight: 50, value: this.trainingQualities.passing },
        { weight: 50, value: this.trainingQualities.technical },
      ]),
    ];
  }

  /** Utilities */

  private createPosition(
    name: HockeyPlayerPosition["name"],
    baseRating: number,
    bonusRating: number
  ): HockeyPlayerPosition {
    const bonus = Math.floor(
      bonusRating > baseRating * HockeyPlayer.BONUS_CAP_RATIO
        ? baseRating * HockeyPlayer.BONUS_CAP_RATIO
        : bonusRating
    );
    const ratingWithBonus = baseRating + bonus;

    return {
      name,
      baseRating: baseRating,
      bonusRating: bonus,
      expBonus: this.calculateExpBonus(baseRating + bonus),
      ratingWithBonus: ratingWithBonus,
      ratingWithXp: ratingWithBonus + this.calculateExpBonus(ratingWithBonus),
    };
  }

  private createPositionTrainingQuality(
    position: HockeyPlayerPosition["name"],
    baseTrainingQualities: TrainingQuality[],
    bonusTrainingQualities?: TrainingQuality[]
  ): HockeyPlayerTrainingQuality {
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
      bonusTrainingQualities
        ? bonusTrainingQualities.reduce(
            (acc, curr) => acc + curr.value * curr.weight,
            0
          ) / bonusTrainingQualitiesTotalWeight
        : 0
    );

    const totalTrainingQuality =
      (baseTrainingQuality * baseTrainingQualitiesTotalWeight +
        bonusTrainingQuality * bonusTrainingQualitiesTotalWeight) /
      (baseTrainingQualitiesTotalWeight + bonusTrainingQualitiesTotalWeight);

    return {
      position: position,
      baseTrainingQuality: Math.floor(baseTrainingQuality),
      bonusTrainingQuality: Math.floor(bonusTrainingQuality),
      totalTrainingQuality: Math.floor(totalTrainingQuality),
    };
  }

  private calculateUnknownRating(): number {
    return (this.overalRating - 100) / 2;
  }

  private calculateExpBonus(rating: number): number {
    return Math.floor(
      rating * (this.experience / HockeyPlayer.EXPERIENCE_DIVISOR)
    );
  }
}
