import { calculateSkillWithExp } from "@/base/calculations";
import { GrowthPrediction } from "@/types/GrowthData";

type WeightedMap = Record<string, number | undefined>;

export type WeightedValue = {
  weight: number;
  value: number;
};

export type CalculatedPosition<Name extends string> = {
  name: Name;
  baseRating: number;
  bonusRating: number;
  expBonus: number;
  ratingWithBonus: number;
  ratingWithXp: number;
};

export type CalculatedTrainingQuality<Name extends string> = {
  position: Name;
  baseTrainingQuality: number;
  bonusTrainingQuality: number;
  totalTrainingQuality: number;
};

export type PositionRule<Name extends string> = {
  name: Name;
  ratios: object;
  bonus?: object;
  trainingRatios?: object;
  trainingBonus?: object;
};

function asWeightedMap(source: object): WeightedMap {
  return source as WeightedMap;
}

function toWeightedValues(values: object, weights?: object): WeightedValue[] {
  if (!weights) {
    return [];
  }

  const sourceValues = asWeightedMap(values);
  const sourceWeights = asWeightedMap(weights);

  return Object.entries(sourceWeights).map(([key, weight]) => ({
    weight: weight ?? 0,
    value: sourceValues[key] ?? 0,
  }));
}

export function calculateWeightedAverage(values: WeightedValue[]): number {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  return Math.floor(
    values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight
  );
}

export function createPosition<Name extends string>(
  name: Name,
  baseRating: number,
  bonusRating: number,
  experience: number,
  bonusCapRatio: number
): CalculatedPosition<Name> {
  const cappedBonus = Math.floor(Math.min(baseRating * bonusCapRatio, bonusRating));
  const ratingWithBonus = baseRating + cappedBonus;
  const ratingWithXp = calculateSkillWithExp(ratingWithBonus, experience);

  return {
    name,
    baseRating,
    bonusRating: cappedBonus,
    expBonus: ratingWithXp - ratingWithBonus,
    ratingWithBonus,
    ratingWithXp,
  };
}

export function createFallbackTrainingQuality<Name extends string>(
  position: Name,
  averageTrainingRatio: number
): CalculatedTrainingQuality<Name> {
  return createTrainingQuality(position, [
    { weight: 1, value: averageTrainingRatio },
  ]);
}

export function createTrainingQuality<Name extends string>(
  position: Name,
  baseValues: WeightedValue[],
  bonusValues: WeightedValue[] = []
): CalculatedTrainingQuality<Name> {
  const baseTrainingQuality = calculateWeightedAverage(baseValues);
  const bonusTrainingQuality = calculateWeightedAverage(bonusValues);
  const baseWeight = baseValues.reduce((sum, item) => sum + item.weight, 0);
  const bonusWeight = bonusValues.reduce((sum, item) => sum + item.weight, 0);
  const totalWeight = baseWeight + bonusWeight;

  const totalTrainingQuality =
    totalWeight === 0
      ? 0
      : Math.floor(
          (baseTrainingQuality * baseWeight + bonusTrainingQuality * bonusWeight) /
            totalWeight
        );

  return {
    position,
    baseTrainingQuality,
    bonusTrainingQuality,
    totalTrainingQuality,
  };
}

export function calculatePositions<Name extends string>(
  skills: object,
  positionRules: PositionRule<Name>[],
  experience: number,
  bonusCapRatio: number
): CalculatedPosition<Name>[] {
  const sourceSkills = asWeightedMap(skills);

  return positionRules.map((position) => {
    const baseRating = Math.min(
      ...Object.entries(asWeightedMap(position.ratios)).map(([skillName, ratio]) =>
        Math.round((sourceSkills[skillName] ?? 0) / (ratio ?? 1))
      )
    );

    const bonusRating = Math.floor(
      Object.entries(asWeightedMap(position.bonus ?? {})).reduce(
        (sum, [skillName, ratio]) =>
          sum + (sourceSkills[skillName] ?? 0) * (ratio ?? 0),
        0
      )
    );

    return createPosition(
      position.name,
      baseRating,
      bonusRating,
      experience,
      bonusCapRatio
    );
  });
}

export function calculatePositionTrainingQualities<Name extends string>(
  trainingQualities: object,
  positionRules: PositionRule<Name>[]
): CalculatedTrainingQuality<Name>[] {
  return positionRules.map((position) =>
    createTrainingQuality(
      position.name,
      toWeightedValues(
        trainingQualities,
        position.trainingRatios ?? position.ratios
      ),
      toWeightedValues(
        trainingQualities,
        position.trainingBonus ?? position.bonus
      )
    )
  );
}

export function calculateProjectedMaxSkillForAge(
  age: number,
  seasonDay: number,
  daysPerSeason: number,
  playerGrowthPrediction: GrowthPrediction
): number {
  const predictionByAge = playerGrowthPrediction.find((row) => row.age === age);

  if (!predictionByAge) {
    return 0;
  }

  const nextPrediction = playerGrowthPrediction.find((row) => row.age === age + 1);

  let skill = predictionByAge.skill;
  let exp = predictionByAge.exp;

  if (nextPrediction) {
    const seasonProgress = seasonDay / daysPerSeason;
    skill += (nextPrediction.skill - predictionByAge.skill) * seasonProgress;
    exp += (nextPrediction.exp - predictionByAge.exp) * seasonProgress;
  }

  return calculateSkillWithExp(Math.round(skill), Math.round(exp));
}
