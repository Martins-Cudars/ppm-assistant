import { createApp } from "vue";
import { parseBasketballPlayerFromProfilePage } from "@/sports/basketball/parsers/playerProfile";
import BasketballPlayerSidebar from "./components/BasketballPlayerSidebar.vue";
import BasketballGrowthChart from "./components/BasketballGrowthChart.vue";
import { captureBasketballPlayers } from "@/sports/basketball/capture";
import { getPlayerTeamId } from "@/utils/dom";

const viewPlayerProfile = () => {
  const playerTable = document.getElementById("table-1");
  const playerInfo = document.querySelector(".player_info");

  if (!playerTable) return new Error("Player table not found");
  if (!playerInfo) return new Error("Player info not found");

  const player = parseBasketballPlayerFromProfilePage(playerTable, playerInfo);
  player.calculatePositions();
  player.calculatePositionTrainingQualities();

  // Any player, other teams' included - the only history source for them.
  const teamId = getPlayerTeamId();
  captureBasketballPlayers([player], "PlayerProfile", {
    ownSquad: false,
    teamId: teamId !== "unknown" ? teamId : undefined,
  });

  const contentColumn = document.querySelector(".column_left");

  // If content column is not found, return
  if (!contentColumn) return new Error("Content column not found");

  const sidebarContainer = document.createElement("div");
  sidebarContainer.id = "ppm-assistant-basketball-sidebar";
  contentColumn.appendChild(sidebarContainer);

  const sidebarApp = createApp(BasketballPlayerSidebar, { player });
  sidebarApp.mount(sidebarContainer);

  // Growth chart right below the profile box. Basketball's layout differs from
  // hockey's: the table sits in .profile_player_center inside a .white_box in
  // .column_center_half (no .column_center_inner), checked on the live site.
  const chartContainer = document.createElement("div");
  chartContainer.id = "ppm-assistant-basketball-chart";
  const profileBox = playerTable.closest(".white_box");
  const centerColumn = document.querySelector(".column_center_half");
  if (profileBox) profileBox.after(chartContainer);
  else if (centerColumn) centerColumn.appendChild(chartContainer);
  else playerTable.parentNode?.appendChild(chartContainer);
  createApp(BasketballGrowthChart, { player }).mount(chartContainer);
};

export default viewPlayerProfile;
