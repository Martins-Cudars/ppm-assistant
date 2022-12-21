const calculatePositionsSkills = (player, positionSettings) => {
  const positionSkills = [];

  positionSettings.forEach((position) => {
    const skills = [];

    for (const [key, value] of Object.entries(position.ratios)) {
      skills.push(parseInt(player.skills[key]) / value);
    }

    positionSkills.push({
      position: position.name,
      level: Math.round(Math.min(...skills)),
    });
  });

  return positionSkills;
};

const calculateBestPosition = (skills) => {
  return skills.sort((a, b) => b.level - a.level)[0];
};

const calculateSkillWithExp = (skill, experience) => {
  return Math.round(skill * (1 + experience / 500));
};

const calculatePositionsQualities = (player, positionSettings) => {
  const positionPotentials = [];

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
      potential: Math.round(Math.min(qualities / modifier)),
    });
  });

  return positionPotentials;
};

const calculateBestPotential = (potentials) => {
  return potentials.sort((a, b) => b.potential - a.potential)[0];
};

export {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
  calculatePositionsQualities,
  calculateBestPotential,
};
