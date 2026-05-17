import {
  ContractInfo,
  HockeyPlayer,
  HockeyPlayerPosition,
  HockeyPlayerTrainingQuality,
  HockeySkills,
} from "@/sports/hockey/classes/HockeyPlayer";
import {
  CsvRow,
  normalizePositionName,
  serializeCsvRow,
  setCsvValue,
} from "@/utils/playerProfileExport";

const hockeySkillKeys: Array<keyof HockeySkills> = [
  "goalie",
  "defence",
  "offence",
  "shooting",
  "passing",
  "technical",
  "aggression",
];

type HockeyPlayerProfileExport = {
  id: string;
  name: string;
  age: number;
  careerLongitivity: number;
  overallRating: number;
  averageTrainingRatio: number;
  experience: number;
  isScouted: boolean;
  isVisible: boolean;
  scoutingStatus: string;
  seasonDay: number;
  updatedAt: string;
  teamId: string | null;
  teamName: string | null;
  preferredSide: string;
  countryImage: string | null;
  countryLink: string | null;
  teamPosition: string | null;
  contract: ContractInfo | null;
  skills: HockeySkills | null;
  trainingQualities: HockeySkills | null;
  positions: HockeyPlayerPosition[];
  positionTrainingQualities: HockeyPlayerTrainingQuality[];
  bestPosition: HockeyPlayerPosition;
  bestPositionTrainingQuality: HockeyPlayerTrainingQuality;
  currentPositionTrainingQuality: HockeyPlayerTrainingQuality | null;
};

function getCurrentPositionTrainingQuality(
  player: HockeyPlayer
): HockeyPlayerTrainingQuality | null {
  try {
    return player.getCurrentPositionTrainingQuality() as HockeyPlayerTrainingQuality;
  } catch {
    return null;
  }
}

function createHockeyPlayerProfileExport(
  player: HockeyPlayer
): HockeyPlayerProfileExport {
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
    scoutingStatus: player.scoutingStatus,
    seasonDay: player.seasonDay,
    updatedAt: player.updatedAt.toISOString(),
    teamId: player.teamId ?? null,
    teamName: player.teamName ?? null,
    preferredSide: player.preferredSide,
    countryImage: player.countryImage ?? null,
    countryLink: player.countryLink ?? null,
    teamPosition: player.teamPosition ?? null,
    contract: player.contract ?? null,
    skills: (player.skills as HockeySkills | undefined) ?? null,
    trainingQualities:
      (player.trainingQualities as HockeySkills | undefined) ?? null,
    positions: player.getPositions() as HockeyPlayerPosition[],
    positionTrainingQualities:
      player.getPositionTrainingQualities() as HockeyPlayerTrainingQuality[],
    bestPosition: player.getBestPosition() as HockeyPlayerPosition,
    bestPositionTrainingQuality:
      player.getBestPositionTrainingQuality() as HockeyPlayerTrainingQuality,
    currentPositionTrainingQuality: getCurrentPositionTrainingQuality(player),
  };
}

function addPositionColumns(
  row: CsvRow,
  positions: HockeyPlayerPosition[],
  positionTrainingQualities: HockeyPlayerTrainingQuality[]
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

function createCsvRow(data: HockeyPlayerProfileExport): CsvRow {
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
  setCsvValue(row, "scouting_status", data.scoutingStatus);
  setCsvValue(row, "season_day", data.seasonDay);
  setCsvValue(row, "updated_at", data.updatedAt);
  setCsvValue(row, "team_id", data.teamId);
  setCsvValue(row, "team_name", data.teamName);
  setCsvValue(row, "preferred_side", data.preferredSide);
  setCsvValue(row, "country_image", data.countryImage);
  setCsvValue(row, "country_link", data.countryLink);
  setCsvValue(row, "team_position", data.teamPosition);
  setCsvValue(row, "contract_salary", data.contract?.salary);
  setCsvValue(row, "contract_days", data.contract?.contractDays);
  setCsvValue(row, "contract_days_in_team", data.contract?.daysInTeam);
  setCsvValue(row, "contract_auto_renewal", data.contract?.autoRenewal);

  for (const skill of hockeySkillKeys) {
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

export function hockeyPlayerProfileToJson(player: HockeyPlayer): string {
  return JSON.stringify(createHockeyPlayerProfileExport(player), null, 2);
}

export function hockeyPlayerProfileToCsv(player: HockeyPlayer): string {
  return serializeCsvRow(createCsvRow(createHockeyPlayerProfileExport(player)));
}
