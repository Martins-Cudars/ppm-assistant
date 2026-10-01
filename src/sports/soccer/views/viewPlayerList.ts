import { createApp } from "vue";
import SoccerPlayerListTable from "./components/SoccerPlayerListTable.vue";
import { getCurrentSeasonDay } from "@/utils/dom";
import { parseSoccerListRow } from "@/sports/soccer/parsers/players";
import { captureSoccerPlayers } from "@/sports/soccer/capture";
import { createPlayerReportButton } from "@/base/playerReportButton";
import type { SoccerPlayerListItem } from "./types";

const viewPlayerList = () => {
  const table = document.getElementById("table-1");

  if (!table) {
    return new Error("Table with id 'table-1' not found");
  }

  const seasonDay = getCurrentSeasonDay();
  const playerRows = table.querySelector("tbody")!.querySelectorAll("tr");
  const headerCells = table.querySelectorAll("thead tr td, thead tr th");
  const headerIndexes = [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const headers = headerIndexes.map(
    (index) => headerCells[index]?.textContent?.trim() || ""
  );
  const items: SoccerPlayerListItem[] = Array.from(playerRows).map((row, index) =>
    parseSoccerListRow(row, index, seasonDay)
  );

  // Store the whole squad: cache, roster and today's history. Not awaited -
  // the table below shouldn't wait on storage.
  captureSoccerPlayers(
    items.map((item) => item.player),
    "PlayersList",
    { ownSquad: true }
  );

  const appContainer = document.createElement("div");
  appContainer.id = "ppm-assistant-soccer-list";

  if (!table.parentNode) {
    return new Error("Table has no parent node");
  }

  // A full-width left-aligned row, so the button sits on the left even if the
  // page centres the table (basketball's does).
  const buttonRow = document.createElement("div");
  buttonRow.style.textAlign = "left";
  buttonRow.appendChild(createPlayerReportButton("soccer"));
  table.parentNode.insertBefore(buttonRow, table);
  table.parentNode.replaceChild(appContainer, table);

  const app = createApp(SoccerPlayerListTable, {
    items,
    headers,
  });
  app.mount(appContainer);
};

export default viewPlayerList;
