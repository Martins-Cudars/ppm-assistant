import { positionSettings } from "@/sports/soccer/settings";
import type { GrowthPredictionItem } from "@/types/GrowthData";

/**
 * Recalculate player growth prediction based on current season day
 * Soccer-specific: uses soccer position settings
 */
export function recalculatePredictDataAccordingToSeasonDay(
  playerGrowthPrediction: GrowthPredictionItem[],
  position: string | undefined,
  day: number
): GrowthPredictionItem {
  const ageIndex = Math.floor(14 + day / 112);
  const remainder = day % 112;

  const currentData = playerGrowthPrediction[ageIndex - 14];
  const nextData = playerGrowthPrediction[ageIndex - 13];

  if (!currentData || !nextData) {
    return { age: 14, skill: 1, exp: 8 };
  }

  // Calculate interpolation
  const skillDiff = nextData.skill - currentData.skill;
  const expDiff = nextData.exp - currentData.exp;
  const interpolationFactor = remainder / 112;

  // Get position-specific ratio
  const positionRatio = position && positionSettings[position]?.predictionRatio || 1;

  return {
    age: ageIndex,
    skill: Math.round(
      (currentData.skill + skillDiff * interpolationFactor) * positionRatio
    ),
    exp: Math.round(currentData.exp + expDiff * interpolationFactor),
  };
}
