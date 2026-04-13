import { createApp } from "vue";
import { parseBasketballPlayerFromProfilePage } from "@/sports/basketball/parsers/playerProfile";
import BasketballPlayerSidebar from "./components/BasketballPlayerSidebar.vue";

const viewPlayerProfile = () => {
  const playerTable = document.getElementById("table-1");
  const playerInfo = document.querySelector(".player_info");

  if (!playerTable) return new Error("Player table not found");
  if (!playerInfo) return new Error("Player info not found");

  const player = parseBasketballPlayerFromProfilePage(playerTable, playerInfo);
  player.calculatePositions();
  player.calculatePositionTrainingQualities();

  const contentColumn = document.querySelector(".column_left");

  // If content column is not found, return
  if (!contentColumn) return new Error("Content column not found");

  const sidebarContainer = document.createElement("div");
  sidebarContainer.id = "ppm-assistant-basketball-sidebar";
  contentColumn.appendChild(sidebarContainer);

  const sidebarApp = createApp(BasketballPlayerSidebar, { player });
  sidebarApp.mount(sidebarContainer);
};

export default viewPlayerProfile;
