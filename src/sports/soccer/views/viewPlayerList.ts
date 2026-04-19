import { createApp } from "vue";
import SoccerPlayerListTable from "./components/SoccerPlayerListTable.vue";
import { getCurrentSeasonDay } from "@/utils/dom";
import { SoccerPlayer } from "@/sports/soccer/classes/SoccerPlayer";
import type { SoccerPlayerListItem } from "./types";

const viewPlayerList = () => {
  const table = document.getElementById("table-1");

  if (!table) {
    return new Error("Table with id 'table-1' not found");
  }

  const seasonDay = getCurrentSeasonDay();
  const playerRows = table.querySelector("tbody")!.querySelectorAll("tr");
  const headerCells = table.querySelectorAll("thead tr td, thead tr th");
  const headerIndexes = [0, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  const headers = headerIndexes.map(
    (index) => headerCells[index]?.textContent?.trim() || ""
  );
  const items: SoccerPlayerListItem[] = [];

  playerRows.forEach((playerRow, index) => {
    const playerColumns = playerRow.querySelectorAll("td");
    const nameLink = playerColumns[0].querySelector(
      'a.link_name, a[href*="speletajs"], a[href*="player"]'
    ) as HTMLAnchorElement | null;
    const countryFlagImg = playerColumns[0].querySelector(
      "a img"
    ) as HTMLImageElement | null;
    const countryFlagLink = countryFlagImg?.closest("a") as HTMLAnchorElement | null;
    const injuryImg = Array.from(playerColumns[0].querySelectorAll("img")).find(
      (img) => img !== countryFlagImg
    ) as HTMLImageElement | undefined;
    const dataParam = nameLink?.href.split("data=")[1] || "";
    const id = dataParam.split("-")[0] || `soccer-list-${index}`;

    const player = new SoccerPlayer(
      {
        id,
        name: nameLink?.textContent?.trim() || playerColumns[0].textContent!.trim(),
        age: parseInt(playerColumns[2].textContent!),
        averageTrainingRatio: parseInt(playerColumns[4].textContent!),
        careerLongitivity: parseInt(
          Array.from(playerColumns[5].textContent!)[0]
        ) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        overallRating: parseInt(playerColumns[16].textContent!),
      },
      new Date(),
      true,
      true,
      seasonDay,
      {
        goalie: parseInt(playerColumns[6].textContent!),
        defence: parseInt(playerColumns[7].textContent!),
        midfield: parseInt(playerColumns[8].textContent!),
        offence: parseInt(playerColumns[9].textContent!),
        shooting: parseInt(playerColumns[10].textContent!),
        passing: parseInt(playerColumns[11].textContent!),
        technical: parseInt(playerColumns[12].textContent!),
        speed: parseInt(playerColumns[13].textContent!),
        heading: parseInt(playerColumns[14].textContent!),
      },
      parseInt(playerColumns[15].textContent!)
    );
    player.calculatePositions();
    items.push({
      player,
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
        ? {
            src: injuryImg.src,
            alt: injuryImg.alt,
            title: injuryImg.title,
          }
        : undefined,
    });
  });

  const appContainer = document.createElement("div");
  appContainer.id = "ppm-assistant-soccer-list";

  if (!table.parentNode) {
    return new Error("Table has no parent node");
  }

  table.parentNode.replaceChild(appContainer, table);

  const app = createApp(SoccerPlayerListTable, {
    items,
    headers,
  });
  app.mount(appContainer);
};

export default viewPlayerList;
