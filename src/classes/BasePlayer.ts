export type BaseInfo = {
  id: string;
  name: string;
  age: number;
  careerLongitivity: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  overallRating: number;
  averageTrainingRatio: number;
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

export class BasePlayer {
  public id: string;
  public name: string;
  public skills: Record<string, number> | undefined;
  public trainingQualities: Record<string, number> | undefined;
  public experience: number;
  public age: number;
  public careerLongitivity: number;
  public overalRating: number;
  public averageTrainingRatio: number;
  public isScouted: boolean;
  public isVisible: boolean;
  public updatedAt: Date;
  public positions: BasePosition[] = [];
  public positionTrainingQualities: BaseTrainingQuality[] = [];

  constructor(
    baseInfo: BaseInfo,
    updatedAt = new Date(),
    isScouted = false,
    isVisible = false,
    skills: Record<string, number> | undefined = undefined,
    experience: number | undefined = undefined,
    trainingQualities: Record<string, number> | undefined = undefined
  ) {
    this.id = baseInfo.id;
    this.name = baseInfo.name;
    this.age = baseInfo.age;
    this.careerLongitivity = baseInfo.careerLongitivity;
    this.overalRating = baseInfo.overallRating;
    this.averageTrainingRatio = baseInfo.averageTrainingRatio;
    this.isScouted = isScouted;
    this.isVisible = isVisible;

    this.skills = skills || undefined;
    this.experience = experience || (this.age - 15) * 8;
    this.trainingQualities = trainingQualities || undefined;
    this.updatedAt = updatedAt;
  }

  calculatePositions() {
    this.positions = [];
  }

  getPositions() {
    return this.positions;
  }

  getBestPosition(): BasePosition {
    return this.positions.sort(
      (a, b) => b.ratingWithBonus - a.ratingWithBonus
    )[0];
  }

  calculatePositionTrainingQualities() {
    this.positionTrainingQualities = [];
  }

  getPositionTrainingQualities(): BaseTrainingQuality[] {
    return this.positionTrainingQualities;
  }

  getBestPositionTrainingQuality(): BaseTrainingQuality {
    console.log(
      "Calculating position training qualities for player",
      this.positionTrainingQualities
    );
    return this.positionTrainingQualities.sort(
      (a, b) => b.totalTrainingQuality - a.totalTrainingQuality
    )[0];
  }

  getCurrentPositionTrainingQuality(): BaseTrainingQuality {
    const currentPosition = this.getBestPosition().name;

    return this.positionTrainingQualities.find(
      (ptq) => ptq.position === currentPosition
    )!;
  }
}
