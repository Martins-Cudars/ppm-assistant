import { createApp } from "vue";
import { parseBasketballPlayerFromListRow } from "@/sports/basketball/parsers/playerRows";
import BasketballPlayerListTable from "./components/BasketballPlayerListTable.vue";
import type { BasketballPlayerListItem } from "./types";

const viewPlayerList = () => {
  const table = document.getElementById("table-1");
  if (!table) {
    console.error("Table with id 'table-1' not found");
    return;
  }

  const legacyPositionSorter = document.querySelector(".center_div.select_form");
  legacyPositionSorter?.remove();

  const playerRows = table.querySelector("tbody")?.querySelectorAll("tr");
  const headerCells = table.querySelectorAll("thead tr td, thead tr th");
  const headerIndexes = [0, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const headers = headerIndexes.map(
    (index) => headerCells[index]?.textContent?.trim() || ""
  );
  const items: BasketballPlayerListItem[] = [];

  playerRows?.forEach((playerRow) => {
    const playerColumns = playerRow.querySelectorAll("td");
    const playerLink = playerColumns[0]?.querySelector(
      'a.link_name, a[href*="player-profile"], a[href*="speletaja-profils"]'
    ) as HTMLAnchorElement | null;
    const countryFlagImg = playerColumns[0]?.querySelector("a img") as HTMLImageElement | null;
    const countryFlagLink = countryFlagImg?.closest("a") as HTMLAnchorElement | null;
    const injuryImg = Array.from(playerColumns[0]?.querySelectorAll("img") || []).find(
      (img) => img !== countryFlagImg
    ) as HTMLImageElement | undefined;

    const player = parseBasketballPlayerFromListRow(playerRow);
    player.calculatePositions();

    items.push({
      player,
      lineupPosition: playerColumns[3]?.textContent?.trim(),
      profileUrl: playerLink?.href || undefined,
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

  if (!table.parentNode) {
    console.error("Table has no parent node");
    return;
  }

  const appContainer = document.createElement("div");
  appContainer.id = "ppm-assistant-basketball-list";
  table.parentNode.replaceChild(appContainer, table);

  const app = createApp(BasketballPlayerListTable, {
    items,
    headers,
  });
  app.mount(appContainer);
};

export default viewPlayerList;
