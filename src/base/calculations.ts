import { GrowthPrediction, GrowthPredictionItem } from "@/types/GrowthData";

const calculateSkillWithExp = (skill: number, experience: number): number => {
  return Math.round(skill * (1 + experience / 500));
};

const calculateRelativeSkill = (
  playerAge: number,
  playerSkillWithExp: number,
  playerGrowthPrediction: GrowthPrediction
): number => {
  const predictionByAge = playerGrowthPrediction.find(
    (row: GrowthPredictionItem) => row.age === playerAge
  );

  if (!predictionByAge) {
    return 0;
  }

  const predictionWithXp = calculateSkillWithExp(
    predictionByAge.skill,
    predictionByAge.exp
  );

  return Math.round((playerSkillWithExp / predictionWithXp) * 100);
};

export {
  calculateSkillWithExp,
  calculateRelativeSkill,
};
