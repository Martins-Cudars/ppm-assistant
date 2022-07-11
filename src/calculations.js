import { positionSettings } from "./settings.js";

const calculatePositionsSkills = (player) => {
  const positionSkills = [];
  positionSettings.forEach((position) => {
    const skills = [];

    for (const [key, value] of Object.entries(position.ratios)) {
      skills.push(parseInt(player.skills[key]) / value);
    }

    positionSkills.push({
      position: position.name,
      level: Math.min(...skills),
    });
  });

  return positionSkills;
};

const calculateBestPosition = (skills) => {
  let bestPosition = {
    position: "Unknown",
    skill: 0,
  };

  skills.forEach((skill) => {
    if (skill.level > bestPosition.skill) {
      bestPosition.position = skill.position;
      bestPosition.skill = skill.level;
    }
  });
  return bestPosition;
};

const calculateSkillWithExp = (skill, experience) => {
  return Math.round(skill * (1 + experience / 500));
};

export {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
};
