import { positionSettings } from "../settings";

const calculateHeightModifier = (
  height: number,
  minHeight: number,
  maxHeight: number
) => {
  return height < minHeight
    ? 1 - (minHeight - height) * 0.03
    : height > maxHeight
    ? 1 - (height - maxHeight) * 0.03
    : 1;
};

const calculatePositionsSkills = (player) => {
  const positionSkills = [];

  positionSettings.forEach((position) => {
    const skills = [];

    for (const [key, value] of Object.entries(position.ratios)) {
      skills.push(parseInt(player.skills[key]) / value);
    }

    const baseSkill = Math.min(...skills);

    positionSkills.push({
      position: position.name,
      level: Math.round(
        baseSkill *
          calculateHeightModifier(
            player.height,
            position.minHeight,
            position.maxHeight
          )
      ),
    });
  });

  return positionSkills;
};

export { calculatePositionsSkills };
