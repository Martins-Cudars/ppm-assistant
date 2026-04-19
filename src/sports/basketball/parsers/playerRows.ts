import {
  BasketballPlayer,
  BasketballPlayerInfo,
  BasketballSkills,
  BasketballTrainingQualities,
} from "@/sports/basketball/classes/BasketballPlayer";

type BasketballPlayerWithId = {
  id: string;
  player: BasketballPlayer;
};

function parseNumber(value: string | null | undefined, fallback = 0): number {
  if (!value) {
    return fallback;
  }

  const parsed = parseInt(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function averageQuality(
  qualities: BasketballTrainingQualities | undefined
): number {
  if (!qualities) {
    return 0;
  }

  const values = Object.values(qualities);
  if (values.length === 0) {
    return 0;
  }

  return Math.floor(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function createPlayer(
  baseInfo: BasketballPlayerInfo,
  skills: BasketballSkills,
  experience?: number,
  qualities?: BasketballTrainingQualities
): BasketballPlayer {
  return new BasketballPlayer(
    {
      ...baseInfo,
      averageTrainingRatio:
        qualities === undefined
          ? baseInfo.averageTrainingRatio
          : averageQuality(qualities),
    },
    new Date(),
    true,
    1,
    skills,
    experience ?? (baseInfo.age > 0 ? undefined : 0),
    qualities
  );
}

function extractTextSkill(cell: HTMLTableCellElement): number {
  return parseNumber(
    Array.from(cell.childNodes).reduce((text, node) => {
      return text + (node.nodeType === 3 ? node.textContent ?? "" : "");
    }, "")
  );
}

function extractSpanSkill(cell: HTMLTableCellElement): number {
  return parseNumber(cell.querySelector("span:first-child")?.textContent);
}

export function parseBasketballPlayerFromListRow(playerRow: HTMLTableRowElement): BasketballPlayer {
  const playerColumns = playerRow.querySelectorAll("td");

  const skills: BasketballSkills = {
    shooting: parseNumber(playerColumns[8]?.textContent),
    blocking: parseNumber(playerColumns[9]?.textContent),
    passing: parseNumber(playerColumns[10]?.textContent),
    technical: parseNumber(playerColumns[11]?.textContent),
    speed: parseNumber(playerColumns[12]?.textContent),
    aggression: parseNumber(playerColumns[13]?.textContent),
    jumping: parseNumber(playerColumns[14]?.textContent),
  };

  return createPlayer(
    {
      id: playerColumns[0]?.querySelector("a")?.getAttribute("href") ?? "unknown",
      name: playerColumns[0]?.textContent?.trim() ?? "Unknown",
      age: parseNumber(playerColumns[4]?.textContent),
      averageTrainingRatio: parseNumber(playerColumns[6]?.textContent),
      careerLongitivity: parseNumber(
        Array.from(playerColumns[7]?.textContent ?? "0")[0]
      ) as BasketballPlayerInfo["careerLongitivity"],
      overallRating: parseNumber(playerColumns[16]?.textContent),
      height: parseNumber(playerColumns[17]?.textContent),
    },
    skills,
    parseNumber(playerColumns[15]?.textContent),
    undefined
  );
}

export function parseBasketballPlayerFromMarketRow(playerRow: HTMLTableRowElement): BasketballPlayer {
  const playerColumns = playerRow.querySelectorAll("td");
  const playerQualities = playerRow.querySelectorAll(".kva");

  const skills: BasketballSkills = {
    shooting: extractTextSkill(playerColumns[5] as HTMLTableCellElement),
    blocking: extractTextSkill(playerColumns[6] as HTMLTableCellElement),
    passing: extractTextSkill(playerColumns[7] as HTMLTableCellElement),
    technical: extractTextSkill(playerColumns[8] as HTMLTableCellElement),
    speed: extractTextSkill(playerColumns[9] as HTMLTableCellElement),
    aggression: extractTextSkill(playerColumns[10] as HTMLTableCellElement),
    jumping: extractTextSkill(playerColumns[11] as HTMLTableCellElement),
  };

  const qualities: BasketballTrainingQualities = {
    shooting: parseNumber(playerQualities[0]?.textContent),
    blocking: parseNumber(playerQualities[1]?.textContent),
    passing: parseNumber(playerQualities[2]?.textContent),
    technical: parseNumber(playerQualities[3]?.textContent),
    speed: parseNumber(playerQualities[4]?.textContent),
    aggression: parseNumber(playerQualities[5]?.textContent),
    jumping: parseNumber(playerQualities[6]?.textContent),
  };

  return createPlayer(
    {
      id:
        playerColumns[0]?.querySelectorAll("a")[1]?.getAttribute("href") ?? "unknown",
      name: playerColumns[0]?.querySelectorAll("a")[1]?.textContent?.trim() ?? "Unknown",
      age: parseNumber(playerColumns[1]?.textContent),
      careerLongitivity: parseNumber(
        Array.from(playerColumns[4]?.querySelector("span")?.textContent ?? "0")[0]
      ) as BasketballPlayerInfo["careerLongitivity"],
      overallRating: parseNumber(playerColumns[13]?.textContent),
      height: parseNumber(playerColumns[14]?.textContent),
      averageTrainingRatio: 0,
    },
    skills,
    parseNumber(playerColumns[12]?.textContent),
    qualities
  );
}

export function parseBasketballPlayerFromLineupRow(
  playerRow: HTMLTableRowElement
): BasketballPlayerWithId {
  const playerColumns = playerRow.querySelectorAll("td");

  const player = createPlayer(
    {
      id:
        playerColumns[1]
          ?.querySelectorAll("a")[1]
          ?.getAttribute("href")
          ?.match(/\d/g)
          ?.join("") ?? "unknown",
      name: playerColumns[1]?.textContent?.trim() ?? "Unknown",
      age: parseNumber(playerColumns[3]?.textContent),
      careerLongitivity: 0,
      overallRating: parseNumber(playerColumns[12]?.textContent),
      height: parseNumber(playerColumns[13]?.textContent),
      averageTrainingRatio: 0,
    },
    {
      shooting: parseNumber(playerColumns[4]?.textContent),
      blocking: parseNumber(playerColumns[5]?.textContent),
      passing: parseNumber(playerColumns[6]?.textContent),
      technical: parseNumber(playerColumns[7]?.textContent),
      speed: parseNumber(playerColumns[8]?.textContent),
      aggression: parseNumber(playerColumns[9]?.textContent),
      jumping: parseNumber(playerColumns[10]?.textContent),
    }
  );

  return {
    id: player.id,
    player,
  };
}

export function parseBasketballPlayerFromTrainingRow(
  playerRow: HTMLTableRowElement
): BasketballPlayer {
  const playerColumns = playerRow.querySelectorAll("td");
  const playerQualities = playerRow.querySelectorAll(".kva");

  const skills: BasketballSkills = {
    shooting: extractSpanSkill(playerColumns[8] as HTMLTableCellElement),
    blocking: extractSpanSkill(playerColumns[9] as HTMLTableCellElement),
    passing: extractSpanSkill(playerColumns[10] as HTMLTableCellElement),
    technical: extractSpanSkill(playerColumns[11] as HTMLTableCellElement),
    speed: extractSpanSkill(playerColumns[12] as HTMLTableCellElement),
    aggression: extractSpanSkill(playerColumns[13] as HTMLTableCellElement),
    jumping: extractSpanSkill(playerColumns[14] as HTMLTableCellElement),
  };

  const qualities: BasketballTrainingQualities = {
    shooting: parseNumber(playerQualities[0]?.textContent),
    blocking: parseNumber(playerQualities[1]?.textContent),
    passing: parseNumber(playerQualities[2]?.textContent),
    technical: parseNumber(playerQualities[3]?.textContent),
    speed: parseNumber(playerQualities[4]?.textContent),
    aggression: parseNumber(playerQualities[6]?.textContent),
    jumping: parseNumber(playerQualities[5]?.textContent),
  };

  return createPlayer(
    {
      id: "training-row",
      name: "Training Player",
      age: 0,
      careerLongitivity: 0,
      overallRating: 0,
      height: 200,
      averageTrainingRatio: 0,
    },
    skills,
    undefined,
    qualities
  );
}
