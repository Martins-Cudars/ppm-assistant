import {
  PositionSkill,
  PositionPotential,
  HockeyPositionSetting,
  SoccerPositionSetting,
  BasketballPositionSetting,
} from "@/types/Position";

import { HockeyPlayer, SoccerPlayer, BasketballPlayer } from "@/types/Player";

type Player = HockeyPlayer | SoccerPlayer | BasketballPlayer;

type PositionSettings =
  | HockeyPositionSetting[]
  | SoccerPositionSetting[]
  | BasketballPositionSetting[];

const calculatePositionsSkills = (
  player: Player,
  positionSettings: PositionSettings
): PositionSkill[] => {
  const positionSkills: PositionSkill[] = [];

  positionSettings.forEach((position) => {
    const skills: number[] = [];

    for (const [key, value] of Object.entries(position.ratios)) {
      skills.push(
        Math.round(parseInt(player.skills[key].toString()) / (value as number))
      );
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
  positionSettings: PositionSettings
): PositionPotential[] => {
  const positionPotentials: PositionPotential[] = [];

  positionSettings.forEach((position) => {
    let qualities = 0;
    let modifier = 0;

    for (const [key, value] of Object.entries(position.ratios)) {
      const ratioValue = value as number; // Type assertion to specify 'value' as number
      qualities += player.qualities[key] * ratioValue;
      modifier += ratioValue;
    }

    if (position.bonus) {
      for (const [key, value] of Object.entries(position.bonus)) {
        const bonusValue = value as number; // Type assertion to specify 'value' as number
        qualities += player.qualities[key] * bonusValue;
        modifier += bonusValue;
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
