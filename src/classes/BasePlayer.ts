import { PlayerCalculationProfile } from "@/classes/playerProfile";
import {
  calculatePositionTrainingQualities,
  calculatePositions,
  calculateProjectedMaxSkillForAge,
  createFallbackTrainingQuality,
  createPosition,
} from "@/classes/playerCalculations";

export type BaseInfo = {
  id: string;
  name: string;
  age: number;
  careerLongitivity: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  overallRating: number;
  averageTrainingRatio: number;
  teamId?: string;
  teamName?: string;
};

export type BasePosition = {
  name: string;
  baseRating: number;
  bonusRating: number;
  expBonus: number;
  ratingWithBonus: number;
  ratingWithXp: number;
};

export type BaseTrainingQuality = {
  position: string;
  baseTrainingQuality: number;
  bonusTrainingQuality: number;
  totalTrainingQuality: number;
};

export abstract class BasePlayer {
  public id: string;
  public name: string;
  public skills: Record<string, number> | undefined;
  public trainingQualities: Record<string, number> | undefined;
  public experience: number;
  public age: number;
  public careerLongitivity: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  public overallRating: number;
  public averageTrainingRatio: number;
  public isScouted: boolean;
  public isVisible: boolean;
  public updatedAt: Date;
  public seasonDay: number;
  public positions: BasePosition[] = [];
  public positionTrainingQualities: BaseTrainingQuality[] = [];
  public injuryDays: number = 0;
  public teamId?: string;
  public teamName?: string;

  constructor(
    baseInfo: BaseInfo,
    updatedAt = new Date(),
    isScouted = false,
    isVisible = false,
    seasonDay = 1,
    skills: Record<string, number> | undefined = undefined,
    experience: number | undefined = undefined,
    trainingQualities: Record<string, number> | undefined = undefined,
    injuryDays = 0
  ) {
    this.id = baseInfo.id;
    this.name = baseInfo.name;
    this.age = baseInfo.age;
    this.careerLongitivity = baseInfo.careerLongitivity;
    this.overallRating = baseInfo.overallRating;
    this.averageTrainingRatio = baseInfo.averageTrainingRatio;
    this.isScouted = isScouted;
    this.isVisible = isVisible;
    this.seasonDay = seasonDay;
    this.teamId = baseInfo.teamId;
    this.teamName = baseInfo.teamName;

    this.skills = skills || undefined;
    this.experience = experience ?? (this.age - 15) * 8;
    this.trainingQualities = trainingQualities || undefined;
    this.updatedAt = updatedAt;
    this.injuryDays = injuryDays;
  }

  protected abstract getCalculationProfile(): PlayerCalculationProfile;

  calculatePositions(): void {
    const profile = this.getCalculationProfile();

    if (!this.skills || (profile.requiresVisibility && !this.isVisible)) {
      this.positions = [
        createPosition(
          profile.unknownPositionName,
          this.getUnknownRating(),
          0,
          this.experience,
          profile.bonusCapRatio
        ),
      ];
      return;
    }

    this.positions = calculatePositions(
      this.skills,
      profile.positionSettings,
      this.experience,
      profile.bonusCapRatio
    );
  }

  getPositions() {
    return this.positions;
  }

  getBestPosition(): BasePosition {
    if (this.positions.length === 0) {
      // Return a safe default position if positions array is empty
      return {
        name: "?",
        baseRating: 0,
        bonusRating: 0,
        expBonus: 0,
        ratingWithBonus: 0,
        ratingWithXp: 0,
      };
    }
    return this.positions.reduce((best, current) =>
      current.ratingWithBonus > best.ratingWithBonus ? current : best
    );
  }

  calculatePositionTrainingQualities(): void {
    const profile = this.getCalculationProfile();

    if (
      !this.trainingQualities ||
      (profile.requiresVisibility && !this.isVisible)
    ) {
      this.positionTrainingQualities = [
        createFallbackTrainingQuality(
          profile.unknownPositionName,
          this.averageTrainingRatio
        ),
      ];
      return;
    }

    this.positionTrainingQualities = calculatePositionTrainingQualities(
      this.trainingQualities,
      profile.positionSettings
    );
  }

  getPositionTrainingQualities(): BaseTrainingQuality[] {
    return this.positionTrainingQualities;
  }

  getBestPositionTrainingQuality(): BaseTrainingQuality {
    if (this.positionTrainingQualities.length === 0) {
      // Return a safe default training quality if array is empty
      return {
        position: "?",
        baseTrainingQuality: 0,
        bonusTrainingQuality: 0,
        totalTrainingQuality: 0,
      };
    }
    return this.positionTrainingQualities.reduce((best, current) =>
      current.totalTrainingQuality > best.totalTrainingQuality ? current : best
    );
  }

  getCurrentPositionTrainingQuality(): BaseTrainingQuality {
    const currentPosition = this.getBestPosition().name;

    const quality = this.positionTrainingQualities.find(
      (ptq) => ptq.position === currentPosition
    );

    if (!quality) {
      throw new Error(`No training quality found for position: ${currentPosition}`);
    }

    return quality;
  }

  protected getUnknownRating(): number {
    return (this.overallRating - 100) / 2;
  }

  getMaxSkillForAge(): number {
    const profile = this.getCalculationProfile();

    return calculateProjectedMaxSkillForAge(
      this.age,
      this.seasonDay,
      profile.daysPerSeason,
      profile.growthPrediction
    );
  }
}
