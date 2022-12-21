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
  const bestPosition = skills.sort((a, b) => b.level - a.level)[0];
  return bestPosition;
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

export {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
  calculatePositionsQualities,
  calculateBestPotential,
};
