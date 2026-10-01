/**
 * Soccer page parsers, shared by the views and capture. Column order and ids
 * are the same in English and Latvian (checked on the live site).
 */

import { SoccerPlayer, SoccerSkills } from "@/sports/soccer/classes/SoccerPlayer";
import type { SoccerPlayerListItem } from "@/sports/soccer/views/types";
import { parseDigits } from "@/base/captureUtils";

type CareerLongevity = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * One squad-overview row. Columns: Name, Pos, Age, ScP, AvQ, CL, then the nine
 * skills (Goa Def Mid Off Sho Pas Tec Spe Hea), Exp, OR, PrS.
 *
 * The id comes from the name's profile link, never the cell's first link -
 * that's the country flag (country-profile.html?data=lva), which once made
 * every basketball row's id a country code.
 */
export function parseSoccerListRow(
  playerRow: HTMLTableRowElement,
  index: number,
  seasonDay: number
): SoccerPlayerListItem {
  const playerColumns = playerRow.querySelectorAll("td");
  const nameLink = playerColumns[0].querySelector(
    'a.link_name, a[href*="speletajs"], a[href*="/player.html"]'
  ) as HTMLAnchorElement | null;
  const countryFlagImg = playerColumns[0].querySelector("a img") as HTMLImageElement | null;
  const countryFlagLink = countryFlagImg?.closest("a") as HTMLAnchorElement | null;
  const injuryImg = Array.from(playerColumns[0].querySelectorAll("img")).find(
    (img) => img !== countryFlagImg
  ) as HTMLImageElement | undefined;
  const dataParam = nameLink?.href.split("data=")[1] || "";
  const id = dataParam.split("-")[0] || `soccer-list-${index}`;
  const cell = (i: number) => playerColumns[i]?.textContent ?? "";

  const player = new SoccerPlayer(
    {
      id,
      name: nameLink?.textContent?.trim() || cell(0).trim(),
      age: parseInt(cell(2)),
      averageTrainingRatio: parseInt(cell(4)),
      careerLongitivity: parseInt(Array.from(cell(5))[0]) as CareerLongevity,
      overallRating: parseDigits(cell(16)),
    },
    new Date(),
    true,
    true,
    seasonDay,
    {
      goalie: parseInt(cell(6)),
      defence: parseInt(cell(7)),
      midfield: parseInt(cell(8)),
      offence: parseInt(cell(9)),
      shooting: parseInt(cell(10)),
      passing: parseInt(cell(11)),
      technical: parseInt(cell(12)),
      speed: parseInt(cell(13)),
      heading: parseInt(cell(14)),
    },
    parseDigits(cell(15))
  );
  player.calculatePositions();

  return {
    player,
    lineupPosition: playerColumns[1]?.textContent?.trim(),
    preferredSide: playerColumns[17]?.textContent?.trim(),
    profileUrl: nameLink?.href,
    countryFlag: countryFlagImg
      ? {
          href: countryFlagLink?.href,
          src: countryFlagImg.src,
          alt: countryFlagImg.alt,
          title: countryFlagImg.title,
        }
      : undefined,
    injuryIndicator: injuryImg
      ? { src: injuryImg.src, alt: injuryImg.alt, title: injuryImg.title }
      : undefined,
  };
}

const readId = (table: HTMLElement, id: string) =>
  table.querySelector(`#${id}`)?.textContent ?? "";

/**
 * The player on a profile page. Skills, XP and training qualities only when
 * the attributes are visible (scouted or own player); otherwise a player with
 * age and OR alone - enough for an OR-only history day, like hockey keeps for
 * unscouted opponents.
 */
export function parseSoccerProfile(
  table: HTMLElement,
  playerInfo: Element,
  seasonDay: number,
  playerId: string
): { player: SoccerPlayer; skillsVisible: boolean } {
  const skillsVisible = !!table.querySelector("#goalie");
  const name =
    playerInfo.querySelector(".link_name")?.textContent?.trim() ||
    playerInfo.querySelectorAll("a")[1]?.textContent?.trim() ||
    "Unknown";

  const skills: SoccerSkills | undefined = skillsVisible
    ? {
        goalie: parseInt(readId(table, "goalie")),
        defence: parseInt(readId(table, "defense")),
        midfield: parseInt(readId(table, "midfield")),
        offence: parseInt(readId(table, "attack")),
        shooting: parseInt(readId(table, "shooting")),
        passing: parseInt(readId(table, "passing")),
        technical: parseInt(readId(table, "technique_attribute")),
        speed: parseInt(readId(table, "speed")),
        heading: parseInt(readId(table, "heading")),
      }
    : undefined;

  const trainingQualities = skillsVisible
    ? {
        goalie: parseInt(readId(table, "kva_goalie")),
        defence: parseInt(readId(table, "kva_defense")),
        midfield: parseInt(readId(table, "kva_midfield")),
        offence: parseInt(readId(table, "kva_attack")),
        shooting: parseInt(readId(table, "kva_shooting")),
        passing: parseInt(readId(table, "kva_passing")),
        technical: parseInt(readId(table, "technique_quality")),
        speed: parseInt(readId(table, "kva_speed")),
        heading: parseInt(readId(table, "kva_heading")),
      }
    : undefined;

  const qualityValues = trainingQualities ? Object.values(trainingQualities) : [];
  const averageTrainingRatio = qualityValues.length
    ? Math.round(qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length)
    : 0;

  const player = new SoccerPlayer(
    {
      id: playerId,
      name,
      age: parseInt(readId(table, "age")),
      careerLongitivity: parseInt(
        Array.from(table.querySelector("#life_time span")?.textContent ?? "0")[0]
      ) as CareerLongevity,
      overallRating: parseDigits(readId(table, "index_skill")),
      averageTrainingRatio,
    },
    new Date(),
    skillsVisible,
    skillsVisible,
    seasonDay,
    skills,
    skillsVisible ? parseDigits(readId(table, "experience")) : undefined,
    trainingQualities
  );
  if (skillsVisible) {
    player.calculatePositions();
    player.calculatePositionTrainingQualities();
  }
  return { player, skillsVisible };
}
