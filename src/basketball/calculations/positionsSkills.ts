import { positionSettings } from "../settings";

interface PositionSkill {
  position: "PG" | "SG" | "SF" | "PF" | "C";
  level: number;
}

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

const calculatePositionsSkills = (player: any): PositionSkill[] => {
  const positionSkills: PositionSkill[] = [];

  positionSettings.forEach((position) => {
    const skills = [];
    const ratios: number[] = [];

    for (const [key, value] of Object.entries(position.ratios)) {
      skills.push(parseInt(player.skills[key]) / value);
      ratios.push(value);
    }

    const baseSkill = Math.min(...skills);
    const maxMultiplier: number = Math.max(...ratios);

    positionSkills.push({
      position: position.name,
      level: Math.round(
        baseSkill *
          maxMultiplier *
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
