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

  const trainableSkill = {
    minimumSkill: { skill: null, ability: null },
    maximumSkill: { skill: null, ability: null },
    difference: null,
  };

  for (const [key, value] of Object.entries(positionRatios)) {
    const adjustedSkill = parseInt(skills[key]) / value;

    if (
      trainableSkill.minimumSkill.ability === null ||
      adjustedSkill < trainableSkill.minimumSkill.ability
    ) {
      trainableSkill.minimumSkill = {
        skill: key,
        ability: adjustedSkill * value,
      };
    }

    trainableSkill.maximumSkill = {
      skill: key,
      ability: adjustedSkill * value,
    };
  }

  trainableSkill.difference =
    trainableSkill.maximumSkill.ability /
      positionRatios[trainableSkill.maximumSkill.skill] -
    trainableSkill.minimumSkill.ability /
      positionRatios[trainableSkill.minimumSkill.skill];

  return trainableSkill;
};

export {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
  calculatePositionsQualities,
  calculateBestPotential,
  calculateTrainableSkill,
};
