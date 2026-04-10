import {
  BasketballPlayer,
  BasketballPlayerInfo,
  BasketballSkills,
  BasketballTrainingQualities,
} from "@/sports/basketball/classes/BasketballPlayer";

function readRequiredNumber(root: ParentNode, selector: string): number {
  const value = root.querySelector(selector)?.textContent;

  if (!value) {
    throw new Error(`Missing numeric value for selector: ${selector}`);
  }

  return parseInt(value);
}

export function parseBasketballPlayerFromProfilePage(
  playerTable: HTMLElement,
  playerInfo: Element
): BasketballPlayer {
  const baseInfo: BasketballPlayerInfo = {
    id: window.location.pathname.split("/").pop() ?? "unknown",
    name: playerInfo.querySelectorAll("a")[1]?.textContent ?? "Unknown",
    age: readRequiredNumber(playerTable, "#age"),
    careerLongitivity: parseInt(
      Array.from(
        playerTable.querySelector("#life_time span")?.textContent ?? "0"
      )[0] ?? "0"
    ) as BasketballPlayerInfo["careerLongitivity"],
    overallRating: readRequiredNumber(playerTable, "#index_skill"),
    averageTrainingRatio: 0,
    height: readRequiredNumber(playerTable, "#vyska"),
  };

  const skills: BasketballSkills = {
    shooting: readRequiredNumber(playerTable, "#shooting"),
    blocking: readRequiredNumber(playerTable, "#block"),
    passing: readRequiredNumber(playerTable, "#passing"),
    technical: readRequiredNumber(playerTable, "#technique_attribute"),
    speed: readRequiredNumber(playerTable, "#speed"),
    aggression: readRequiredNumber(playerTable, "#aggressivity"),
    jumping: readRequiredNumber(playerTable, "#leaping"),
  };

  const qualities: BasketballTrainingQualities = {
    shooting: readRequiredNumber(playerTable, "#kva_shooting"),
    blocking: readRequiredNumber(playerTable, "#kva_block"),
    passing: readRequiredNumber(playerTable, "#kva_passing"),
    technical: readRequiredNumber(playerTable, "#technique_quality"),
    speed: readRequiredNumber(playerTable, "#kva_speed"),
    aggression: readRequiredNumber(playerTable, "#kva_aggressivity"),
    jumping: readRequiredNumber(playerTable, "#kva_leaping"),
  };

  const experience = readRequiredNumber(playerTable, "#experience");
  const averageTrainingRatio = Math.floor(
    Object.values(qualities).reduce((sum, quality) => sum + quality, 0) /
      Object.values(qualities).length
  );

  return new BasketballPlayer(
    {
      ...baseInfo,
      averageTrainingRatio,
    },
    new Date(),
    true,
    1,
    skills,
    experience,
    qualities
  );
}
