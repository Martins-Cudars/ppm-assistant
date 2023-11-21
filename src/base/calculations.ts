import {
  PositionSkill,
  PositionPotential,
  HockeyPositionSetting,
} from "@/types/Position";

interface Player {
  skills: { [key: string]: number };
  qualities: { [key: string]: number };
}

const calculatePositionsSkills = (
  player: Player,
  positionSettings: HockeyPositionSetting[]
): PositionSkill[] => {
  const positionSkills: PositionSkill[] = [];

  positionSettings.forEach((position) => {
    const skills: number[] = [];

    for (const [key, value] of Object.entries(position.ratios)) {
      skills.push(Math.round(parseInt(player.skills[key].toString()) / value));
    }

    positionSkills.push({
      position: position.name,
      level: Math.min(...skills),
    });
  });

  return positionSkills;
};

const calculateBestPosition = (skills: PositionSkill[]): PositionSkill => {
  return skills.sort((a, b) => b.level - a.level)[0];
};

const calculateSkillWithExp = (skill: number, experience: number): number => {
  return Math.round(skill * (1 + experience / 500));
};

const calculatePositionsQualities = (
  player: Player,
  positionSettings: HockeyPositionSetting[]
): PositionPotential[] => {
  const positionPotentials: PositionPotential[] = [];

  positionSettings.forEach((position) => {
    let qualities = 0;
    let modifier = 0;

    for (const [key, value] of Object.entries(position.ratios)) {
      qualities += player.qualities[key] * value;
      modifier += value;
    }

    if (position.bonus) {
      for (const [key, value] of Object.entries(position.bonus)) {
        qualities += player.qualities[key] * value;
        modifier += value;
      }
    }

    positionPotentials.push({
      position: position.name,
      potential: Math.round(qualities / modifier),
    });
  });

  return positionPotentials;
};

const calculateBestPotential = (
  potentials: PositionPotential[]
): PositionPotential => {
  return potentials.sort((a, b) => b.potential - a.potential)[0];
};

export {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
  calculatePositionsQualities,
  calculateBestPotential,
};
