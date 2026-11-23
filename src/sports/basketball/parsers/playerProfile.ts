import { getCurrentSeasonDay } from "@/utils/dom";
import {
  BasketballPlayer,
  BasketballPlayerInfo,
  BasketballSkills,
  BasketballTrainingQualities,
} from "@/sports/basketball/classes/BasketballPlayer";

/**
 * A whole number from the profile table, or null when the cell is missing,
 * empty or not a number - an unscouted player's page shows "-" or nothing
 * for skills, qualities and sometimes XP.
 */
function readNumber(root: ParentNode, selector: string): number | null {
  // \s covers the non-breaking space the game puts in thousands.
  const text = root.querySelector(selector)?.textContent?.replace(/\s/g, "") ?? "";
  const value = parseInt(text, 10);
  return /^-?\d/.test(text) && Number.isFinite(value) ? value : null;
}

/** Every value of a group, or undefined when any is unknown (no partial sets). */
function readAll<K extends string>(root: ParentNode, selectors: Record<K, string>): Record<K, number> | undefined {
  const values = {} as Record<K, number>;
  for (const key of Object.keys(selectors) as K[]) {
    const value = readNumber(root, selectors[key]);
    if (value === null) return undefined;
    values[key] = value;
  }
  return values;
}

function readRequiredNumber(root: ParentNode, selector: string): number {
  const value = readNumber(root, selector);
  if (value === null) throw new Error(`Missing numeric value for selector: ${selector}`);
  return value;
}

/**
 * The player on a basketball profile page. `seasonDay` defaults to the game
 * bar's; `playerTable` and `playerInfo` may be any ParentNode/Element (a
 * check passes a fixture).
 */
export function parseBasketballPlayerFromProfilePage(
  playerTable: ParentNode,
  playerInfo: Element,
  seasonDay: number = getCurrentSeasonDay(),
  dataParam: string = new URLSearchParams(window.location.search).get("data") || ""
): BasketballPlayer {
  const extractedId =
    dataParam.split("-")[0] ||
    (typeof window !== "undefined" ? window.location.pathname.split("/").pop() : "") ||
    "unknown";

  const baseInfo: BasketballPlayerInfo = {
    id: extractedId,
    name: playerInfo.querySelectorAll("a")[1]?.textContent ?? "Unknown",
    age: readRequiredNumber(playerTable, "#age"),
    careerLongitivity: parseInt(
      Array.from(
        playerTable.querySelector("#life_time span")?.textContent ?? "0"
      )[0] ?? "0"
    ) as BasketballPlayerInfo["careerLongitivity"],
    overallRating: readRequiredNumber(playerTable, "#index_skill"),
    averageTrainingRatio: 0,
    // 0 when the page doesn't show it; capture and the charts skip a 0 height.
    height: readNumber(playerTable, "#vyska") ?? 0,
  };

  // An unscouted player's page has OR, age, height and a few info fields, but
  // no skills or qualities: those stay unknown (undefined), never 0.
  const skills: BasketballSkills | undefined = readAll(playerTable, {
    shooting: "#shooting",
    blocking: "#block",
    passing: "#passing",
    technical: "#technique_attribute",
    speed: "#speed",
    aggression: "#aggressivity",
    jumping: "#leaping",
  });

  const qualities: BasketballTrainingQualities | undefined = readAll(playerTable, {
    shooting: "#kva_shooting",
    blocking: "#kva_block",
    passing: "#kva_passing",
    technical: "#technique_quality",
    speed: "#kva_speed",
    aggression: "#kva_aggressivity",
    jumping: "#kva_leaping",
  });

  const experience = readNumber(playerTable, "#experience") ?? undefined;
  const averageTrainingRatio = qualities
    ? Math.floor(
        Object.values(qualities).reduce((sum, quality) => sum + quality, 0) / Object.values(qualities).length
      )
    : 0;

  return new BasketballPlayer(
    {
      ...baseInfo,
      averageTrainingRatio,
    },
    new Date(),
    true,
    seasonDay,
    skills,
    experience,
    qualities
  );
}
