import {
  calculatePositionTrainingQualities,
} from "@/classes/playerCalculations";
import { BasketballPositionSetting } from "@/types/Position";
import { calculateSkillWithExp } from "@/base/calculations";
import {
  BasketballPlayerPosition,
  BasketballPlayerTrainingQuality,
  BasketballSkills,
  BasketballTrainingQualities,
} from "@/sports/basketball/classes/BasketballPlayer";

function calculateHeightModifier(
  height: number,
  minHeight: number,
  maxHeight: number
): number {
  return height < minHeight
    ? 1 - (minHeight - height) * 0.025
    : height > maxHeight
      ? 1 - (height - maxHeight) * 0.025
      : 1;
}

export function calculateBasketballPositions(
  skills: BasketballSkills,
  height: number,
  experience: number,
  positionSettings: BasketballPositionSetting[]
): BasketballPlayerPosition[] {
  return positionSettings.map((position) => {
      const baseSkill = Math.min(
        ...Object.entries(position.ratios).map(([skillName, ratio]) =>
          Math.round(skills[skillName as keyof BasketballSkills] / (ratio ?? 1))
        )
      );

      const heightModifier = calculateHeightModifier(
        height,
        position.minHeight,
        position.maxHeight
      );

      const ratingWithBonus = Math.round(baseSkill * heightModifier);
      const ratingWithXp = calculateSkillWithExp(ratingWithBonus, experience);

      return {
        name: position.name,
        baseRating: ratingWithBonus,
        bonusRating: 0,
        expBonus: ratingWithXp - ratingWithBonus,
        ratingWithBonus,
        ratingWithXp,
      };
    });
}

export function calculateBasketballPositionTrainingQualities(
  qualities: BasketballTrainingQualities,
  positionSettings: BasketballPositionSetting[]
): BasketballPlayerTrainingQuality[] {
  return calculatePositionTrainingQualities(
    qualities,
    positionSettings
  ) as BasketballPlayerTrainingQuality[];
}
