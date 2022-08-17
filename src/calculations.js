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

const calculatePositionsQualities = (player) => {
  const positionPotentials = [];

  positionSettings.forEach((position) => {
    let qualities = 0;
    let modifier = 0;

    for (const [key, value] of Object.entries(position.ratios)) {
      qualities += player.qualities[key] * value;
      modifier += value;
    }

    positionPotentials.push({
      position: position.name,
      potential: Math.min(qualities / modifier),
    });
  });

  return positionPotentials;
};

const calculateBestPotential = (potentials) => {
  let bestPotential = {
    position: "Unknown",
    potential: 0,
  };

  potentials.forEach((potential) => {
    if (potential.potential > bestPotential.potential) {
      bestPotential.position = potential.position;
      bestPotential.potential = potential.potential;
    }
  });
  return bestPotential;
};

const calculateTrainableSkill = (skills, position) => {
  const positionRatios = positionSettings.find(
    (name) => name.name === position.position
  ).ratios;

  let minimumSkill = { position: "unkown", skill: 9999 };

  for (const [key, value] of Object.entries(positionRatios)) {
    const adjustedSkill = parseInt(skills[key]) / value;

    if (adjustedSkill < minimumSkill.skill) {
      minimumSkill.position = key;
      minimumSkill.skill = adjustedSkill;
    }
  }

  console.log(minimumSkill);
  return positionRatios;
};

export {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
  calculatePositionsQualities,
  calculateBestPotential,
  calculateTrainableSkill,
};
