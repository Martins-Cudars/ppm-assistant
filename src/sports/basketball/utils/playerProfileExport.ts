import {
  BasketballPlayer,
  BasketballPlayerPosition,
  BasketballPlayerTrainingQuality,
  BasketballSkills,
  BasketballTrainingQualities,
} from "@/sports/basketball/classes/BasketballPlayer";
import {
  CsvRow,
  normalizePositionName,
  serializeCsvRow,
  setCsvValue,
} from "@/utils/playerProfileExport";

const basketballSkillKeys: Array<keyof BasketballSkills> = [
  "shooting",
  "blocking",
  "passing",
  "technical",
  "speed",
  "aggression",
  "jumping",
];

type BasketballPlayerProfileExport = {
  id: string;
  name: string;
  age: number;
  careerLongitivity: number;
  overallRating: number;
  averageTrainingRatio: number;
  height: number;
  experience: number;
  isScouted: boolean;
  isVisible: boolean;
  seasonDay: number;
  updatedAt: string;
  skills: BasketballSkills | null;
  trainingQualities: BasketballTrainingQualities | null;
  positions: BasketballPlayerPosition[];
  positionTrainingQualities: BasketballPlayerTrainingQuality[];
  bestPosition: BasketballPlayerPosition;
  bestPositionTrainingQuality: BasketballPlayerTrainingQuality;
  currentPositionTrainingQuality: BasketballPlayerTrainingQuality | null;
};

function getCurrentPositionTrainingQuality(
  player: BasketballPlayer
): BasketballPlayerTrainingQuality | null {
  try {
    return player.getCurrentPositionTrainingQuality() as BasketballPlayerTrainingQuality;
  } catch {
    return null;
  }
}

function createBasketballPlayerProfileExport(
  player: BasketballPlayer
): BasketballPlayerProfileExport {
  return {
    id: player.id,
    name: player.name,
    age: player.age,
    careerLongitivity: player.careerLongitivity,
    overallRating: player.overallRating,
    averageTrainingRatio: player.averageTrainingRatio,
    height: player.height,
    experience: player.experience,
    isScouted: player.isScouted,
    isVisible: player.isVisible,
    seasonDay: player.seasonDay,
    updatedAt: player.updatedAt.toISOString(),
    skills: player.skills ?? null,
    trainingQualities: player.trainingQualities ?? null,
    positions: player.getPositions() as BasketballPlayerPosition[],
    positionTrainingQualities:
      player.getPositionTrainingQualities() as BasketballPlayerTrainingQuality[],
    bestPosition: player.getBestPosition() as BasketballPlayerPosition,
    bestPositionTrainingQuality:
      player.getBestPositionTrainingQuality() as BasketballPlayerTrainingQuality,
    currentPositionTrainingQuality: getCurrentPositionTrainingQuality(player),
  };
}

function createCsvRow(data: BasketballPlayerProfileExport): CsvRow {
  const row: CsvRow = {};

  setCsvValue(row, "id", data.id);
  setCsvValue(row, "name", data.name);
  setCsvValue(row, "age", data.age);
  setCsvValue(row, "career_longitivity", data.careerLongitivity);
  setCsvValue(row, "overall_rating", data.overallRating);
  setCsvValue(row, "average_training_ratio", data.averageTrainingRatio);
  setCsvValue(row, "height", data.height);
  setCsvValue(row, "experience", data.experience);
  setCsvValue(row, "is_scouted", data.isScouted);
  setCsvValue(row, "is_visible", data.isVisible);
  setCsvValue(row, "season_day", data.seasonDay);
  setCsvValue(row, "updated_at", data.updatedAt);

  for (const skill of basketballSkillKeys) {
    setCsvValue(row, `skill_${skill}`, data.skills?.[skill]);
    setCsvValue(
      row,
      `training_quality_${skill}`,
      data.trainingQualities?.[skill]
    );
  }

  setCsvValue(row, "best_position", data.bestPosition.name);
  setCsvValue(row, "best_position_base_rating", data.bestPosition.baseRating);
  setCsvValue(row, "best_position_bonus_rating", data.bestPosition.bonusRating);
  setCsvValue(row, "best_position_exp_bonus", data.bestPosition.expBonus);
  setCsvValue(
    row,
    "best_position_rating_with_bonus",
    data.bestPosition.ratingWithBonus
  );
  setCsvValue(
    row,
    "best_position_rating_with_xp",
    data.bestPosition.ratingWithXp
  );

  setCsvValue(
    row,
    "best_position_training_quality_position",
    data.bestPositionTrainingQuality.position
  );
  setCsvValue(
    row,
    "best_position_training_quality_base",
    data.bestPositionTrainingQuality.baseTrainingQuality
  );
  setCsvValue(
    row,
    "best_position_training_quality_bonus",
    data.bestPositionTrainingQuality.bonusTrainingQuality
  );
  setCsvValue(
    row,
    "best_position_training_quality_total",
    data.bestPositionTrainingQuality.totalTrainingQuality
  );

  if (data.currentPositionTrainingQuality) {
    setCsvValue(
      row,
      "current_position_training_quality_position",
      data.currentPositionTrainingQuality.position
    );
    setCsvValue(
      row,
      "current_position_training_quality_base",
      data.currentPositionTrainingQuality.baseTrainingQuality
    );
    setCsvValue(
      row,
      "current_position_training_quality_bonus",
      data.currentPositionTrainingQuality.bonusTrainingQuality
    );
    setCsvValue(
      row,
      "current_position_training_quality_total",
      data.currentPositionTrainingQuality.totalTrainingQuality
    );
  }

  for (const position of data.positions) {
    const positionKey = normalizePositionName(position.name);
    setCsvValue(row, `position_${positionKey}_base_rating`, position.baseRating);
    setCsvValue(row, `position_${positionKey}_bonus_rating`, position.bonusRating);
    setCsvValue(row, `position_${positionKey}_exp_bonus`, position.expBonus);
    setCsvValue(
      row,
      `position_${positionKey}_rating_with_bonus`,
      position.ratingWithBonus
    );
    setCsvValue(
      row,
      `position_${positionKey}_rating_with_xp`,
      position.ratingWithXp
    );
  }

  for (const quality of data.positionTrainingQualities) {
    const positionKey = normalizePositionName(quality.position);
    setCsvValue(
      row,
      `position_training_quality_${positionKey}_base_training_quality`,
      quality.baseTrainingQuality
    );
    setCsvValue(
      row,
      `position_training_quality_${positionKey}_bonus_training_quality`,
      quality.bonusTrainingQuality
    );
    setCsvValue(
      row,
      `position_training_quality_${positionKey}_total_training_quality`,
      quality.totalTrainingQuality
    );
  }

  return row;
}

export function basketballPlayerProfileToJson(
  player: BasketballPlayer
): string {
  return JSON.stringify(createBasketballPlayerProfileExport(player), null, 2);
}

export function basketballPlayerProfileToCsv(player: BasketballPlayer): string {
  const row = createCsvRow(createBasketballPlayerProfileExport(player));
  return serializeCsvRow(row);
}
