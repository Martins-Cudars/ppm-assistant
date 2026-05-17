import {
  SoccerPlayer,
  SoccerPlayerPosition,
  SoccerPlayerTrainingQuality,
  SoccerSkills,
} from "@/sports/soccer/classes/SoccerPlayer";
import {
  CsvRow,
  normalizePositionName,
  serializeCsvRow,
  setCsvValue,
} from "@/utils/playerProfileExport";

const soccerSkillKeys: Array<keyof SoccerSkills> = [
  "goalie",
  "defence",
  "midfield",
  "offence",
  "shooting",
  "passing",
  "technical",
  "speed",
  "heading",
];

type SoccerPlayerProfileExport = {
  id: string;
  name: string;
  age: number;
  careerLongitivity: number;
  overallRating: number;
  averageTrainingRatio: number;
  experience: number;
  isScouted: boolean;
  isVisible: boolean;
  seasonDay: number;
  updatedAt: string;
  teamId: string | null;
  teamName: string | null;
  skills: SoccerSkills | null;
  trainingQualities: SoccerSkills | null;
  positions: SoccerPlayerPosition[];
  positionTrainingQualities: SoccerPlayerTrainingQuality[];
  bestPosition: SoccerPlayerPosition;
  bestPositionTrainingQuality: SoccerPlayerTrainingQuality;
  currentPositionTrainingQuality: SoccerPlayerTrainingQuality | null;
};

function getCurrentPositionTrainingQuality(
  player: SoccerPlayer
): SoccerPlayerTrainingQuality | null {
  try {
    return player.getCurrentPositionTrainingQuality() as SoccerPlayerTrainingQuality;
  } catch {
    return null;
  }
}

function createSoccerPlayerProfileExport(
  player: SoccerPlayer
): SoccerPlayerProfileExport {
  return {
    id: player.id,
    name: player.name,
    age: player.age,
    careerLongitivity: player.careerLongitivity,
    overallRating: player.overallRating,
    averageTrainingRatio: player.averageTrainingRatio,
    experience: player.experience,
    isScouted: player.isScouted,
    isVisible: player.isVisible,
    seasonDay: player.seasonDay,
    updatedAt: player.updatedAt.toISOString(),
    teamId: player.teamId ?? null,
    teamName: player.teamName ?? null,
    skills: player.skills ?? null,
    trainingQualities:
      (player.trainingQualities as SoccerSkills | undefined) ?? null,
    positions: player.getPositions() as SoccerPlayerPosition[],
    positionTrainingQualities:
      player.getPositionTrainingQualities() as SoccerPlayerTrainingQuality[],
    bestPosition: player.getBestPosition() as SoccerPlayerPosition,
    bestPositionTrainingQuality:
      player.getBestPositionTrainingQuality() as SoccerPlayerTrainingQuality,
    currentPositionTrainingQuality: getCurrentPositionTrainingQuality(player),
  };
}

function addPositionColumns(
  row: CsvRow,
  positions: SoccerPlayerPosition[],
  positionTrainingQualities: SoccerPlayerTrainingQuality[]
): void {
  for (const position of positions) {
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

  for (const quality of positionTrainingQualities) {
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
}

function createCsvRow(data: SoccerPlayerProfileExport): CsvRow {
  const row: CsvRow = {};

  setCsvValue(row, "id", data.id);
  setCsvValue(row, "name", data.name);
  setCsvValue(row, "age", data.age);
  setCsvValue(row, "career_longitivity", data.careerLongitivity);
  setCsvValue(row, "overall_rating", data.overallRating);
  setCsvValue(row, "average_training_ratio", data.averageTrainingRatio);
  setCsvValue(row, "experience", data.experience);
  setCsvValue(row, "is_scouted", data.isScouted);
  setCsvValue(row, "is_visible", data.isVisible);
  setCsvValue(row, "season_day", data.seasonDay);
  setCsvValue(row, "updated_at", data.updatedAt);
  setCsvValue(row, "team_id", data.teamId);
  setCsvValue(row, "team_name", data.teamName);

  for (const skill of soccerSkillKeys) {
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

  addPositionColumns(row, data.positions, data.positionTrainingQualities);

  return row;
}

export function soccerPlayerProfileToJson(player: SoccerPlayer): string {
  return JSON.stringify(createSoccerPlayerProfileExport(player), null, 2);
}

export function soccerPlayerProfileToCsv(player: SoccerPlayer): string {
  return serializeCsvRow(createCsvRow(createSoccerPlayerProfileExport(player)));
}
