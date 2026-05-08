import {
  BasketballPlayer,
  BasketballPlayerPosition,
  BasketballPlayerTrainingQuality,
  BasketballSkills,
  BasketballTrainingQualities,
} from "@/sports/basketball/classes/BasketballPlayer";

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

function normalizePositionName(position: string): string {
  return position === "?" ? "unknown" : position.toLowerCase();
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function setValue(
  row: Record<string, string | number | boolean | null>,
  key: string,
  value: string | number | boolean | null | undefined
): void {
  row[key] = value ?? null;
}

function createCsvRow(
  data: BasketballPlayerProfileExport
): Record<string, string | number | boolean | null> {
  const row: Record<string, string | number | boolean | null> = {};

  setValue(row, "id", data.id);
  setValue(row, "name", data.name);
  setValue(row, "age", data.age);
  setValue(row, "career_longitivity", data.careerLongitivity);
  setValue(row, "overall_rating", data.overallRating);
  setValue(row, "average_training_ratio", data.averageTrainingRatio);
  setValue(row, "height", data.height);
  setValue(row, "experience", data.experience);
  setValue(row, "is_scouted", data.isScouted);
  setValue(row, "is_visible", data.isVisible);
  setValue(row, "season_day", data.seasonDay);
  setValue(row, "updated_at", data.updatedAt);

  for (const skill of basketballSkillKeys) {
    setValue(row, `skill_${skill}`, data.skills?.[skill]);
    setValue(
      row,
      `training_quality_${skill}`,
      data.trainingQualities?.[skill]
    );
  }

  setValue(row, "best_position", data.bestPosition.name);
  setValue(row, "best_position_base_rating", data.bestPosition.baseRating);
  setValue(row, "best_position_bonus_rating", data.bestPosition.bonusRating);
  setValue(row, "best_position_exp_bonus", data.bestPosition.expBonus);
  setValue(
    row,
    "best_position_rating_with_bonus",
    data.bestPosition.ratingWithBonus
  );
  setValue(row, "best_position_rating_with_xp", data.bestPosition.ratingWithXp);

  setValue(
    row,
    "best_position_training_quality_position",
    data.bestPositionTrainingQuality.position
  );
  setValue(
    row,
    "best_position_training_quality_base",
    data.bestPositionTrainingQuality.baseTrainingQuality
  );
  setValue(
    row,
    "best_position_training_quality_bonus",
    data.bestPositionTrainingQuality.bonusTrainingQuality
  );
  setValue(
    row,
    "best_position_training_quality_total",
    data.bestPositionTrainingQuality.totalTrainingQuality
  );

  if (data.currentPositionTrainingQuality) {
    setValue(
      row,
      "current_position_training_quality_position",
      data.currentPositionTrainingQuality.position
    );
    setValue(
      row,
      "current_position_training_quality_base",
      data.currentPositionTrainingQuality.baseTrainingQuality
    );
    setValue(
      row,
      "current_position_training_quality_bonus",
      data.currentPositionTrainingQuality.bonusTrainingQuality
    );
    setValue(
      row,
      "current_position_training_quality_total",
      data.currentPositionTrainingQuality.totalTrainingQuality
    );
  }

  for (const position of data.positions) {
    const positionKey = normalizePositionName(position.name);
    setValue(row, `position_${positionKey}_base_rating`, position.baseRating);
    setValue(row, `position_${positionKey}_bonus_rating`, position.bonusRating);
    setValue(row, `position_${positionKey}_exp_bonus`, position.expBonus);
    setValue(
      row,
      `position_${positionKey}_rating_with_bonus`,
      position.ratingWithBonus
    );
    setValue(
      row,
      `position_${positionKey}_rating_with_xp`,
      position.ratingWithXp
    );
  }

  for (const quality of data.positionTrainingQualities) {
    const positionKey = normalizePositionName(quality.position);
    setValue(
      row,
      `position_training_quality_${positionKey}_base_training_quality`,
      quality.baseTrainingQuality
    );
    setValue(
      row,
      `position_training_quality_${positionKey}_bonus_training_quality`,
      quality.bonusTrainingQuality
    );
    setValue(
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
  const headers = Object.keys(row);
  const values = headers.map((header) => escapeCsvValue(row[header]));

  return `${headers.join(",")}\n${values.join(",")}`;
}
