import { BasePlayer, BaseInfo } from "@/classes/BasePlayer";
import { playerGrowthPrediction } from "@/sports/hockey/settings";
import { calculateSkillWithExp } from "@/base/calculations";

export type ContractInfo = {
  contractDays?: number;      // Days remaining on contract
  salary?: number;            // Current salary
  daysInTeam?: number;        // Days player has been on team
  autoRenewal?: boolean;      // Auto-renewal enabled
};

export type HockeyPlayerInfo = BaseInfo & {
  preferredSide: "L" | "R" | "U";
  countryImage?: string;
  countryLink?: string;
  teamPosition?: string;
  contract?: ContractInfo;    // Grouped contract/financial data
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

export type ScoutingStatus = "SCOUTED" | "IN_PROGRESS" | "UNSCOUTED";

export class HockeyPlayer extends BasePlayer {
  private static readonly BONUS_CAP_RATIO = 0.6;
  private static readonly EXPERIENCE_DIVISOR = 500;
  private static readonly DAYS_PER_SEASON = 112;

  // Defense position bonus weights
  private static readonly DEFENSE_SHOOTING_WEIGHT = 0.25;
  private static readonly DEFENSE_TECHNICAL_WEIGHT = 0.25;
  private static readonly DEFENSE_OFFENCE_WEIGHT = 0.1;

  // Winger/Center position bonus weights
  private static readonly FORWARD_SHOOTING_WEIGHT = 0.45;
  private static readonly FORWARD_DEFENSE_WEIGHT = 0.1;

  public preferredSide: "L" | "R" | "U";
  public countryImage?: string;
  public countryLink?: string;
  public teamPosition?: string;
  public contract?: ContractInfo;
  public scoutingStatus: ScoutingStatus;
  public positions: HockeyPlayerPosition[] = []; // Initialize arrays
  public positionTrainingQualities: HockeyPlayerTrainingQuality[] = []; // Initialize arrays

  constructor(
    baseInfo: HockeyPlayerInfo,
    updatedAt = new Date(),
    scoutingStatus: ScoutingStatus = "UNSCOUTED",
    isVisible = false,
    seasonDay = 1,
    skills?: HockeySkills, // Use optional parameter syntax
    experience?: number, // Use optional parameter syntax
    trainingQualities?: Record<string, number>, // Use optional parameter syntax
    injuryDays = 0
  ) {
    super(
      baseInfo,
      updatedAt,
      scoutingStatus === "SCOUTED",
      isVisible,
      seasonDay,
      skills,
      experience,
      trainingQualities,
      injuryDays
    );
    this.preferredSide = baseInfo.preferredSide;
    this.countryImage = baseInfo.countryImage;
    this.countryLink = baseInfo.countryLink;
    this.teamPosition = baseInfo.teamPosition;
    this.contract = baseInfo.contract;
    this.scoutingStatus = scoutingStatus;
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
          this.skills.shooting * HockeyPlayer.DEFENSE_SHOOTING_WEIGHT +
            this.skills.technical * HockeyPlayer.DEFENSE_TECHNICAL_WEIGHT +
            this.skills.offence * HockeyPlayer.DEFENSE_OFFENCE_WEIGHT
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
        Math.floor(
          this.skills.shooting * HockeyPlayer.FORWARD_SHOOTING_WEIGHT +
            this.skills.defence * HockeyPlayer.FORWARD_DEFENSE_WEIGHT
        )
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
        Math.floor(
          this.skills.shooting * HockeyPlayer.FORWARD_SHOOTING_WEIGHT +
            this.skills.defence * HockeyPlayer.FORWARD_DEFENSE_WEIGHT
        )
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
      bonusTrainingQualities && bonusTrainingQualitiesTotalWeight > 0
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
    return (this.overallRating - 100) / 2;
  }

  private calculateExpBonus(rating: number): number {
    return Math.floor(
      rating * (this.experience / HockeyPlayer.EXPERIENCE_DIVISOR)
    );
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
      const seasonProgress = this.seasonDay / HockeyPlayer.DAYS_PER_SEASON;
      skill += (nextPrediction.skill - predictionByAge.skill) * seasonProgress;
      exp += (nextPrediction.exp - predictionByAge.exp) * seasonProgress;
    }

    return calculateSkillWithExp(Math.round(skill), Math.round(exp));
  }
}
