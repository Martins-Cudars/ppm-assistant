import { createApp } from "vue";
import { getCurrentSeasonDay, getPlayerTeamId } from "@/utils/dom";
import { parseSoccerProfile } from "@/sports/soccer/parsers/players";
import { captureSoccerPlayers } from "@/sports/soccer/capture";
import SoccerPlayerSidebar from "./components/SoccerPlayerSidebar.vue";
import SoccerPlayerGrowthChart from "./components/SoccerPlayerGrowthChart.vue";

const viewPlayerProfile = () => {
  const table = document.getElementById("table-1");
  const playerInfo = document.querySelector(".player_info");

  if (!table) return new Error("Player table not found");
  if (!playerInfo) return new Error("Player info not found");

  const searchParams = new URLSearchParams(window.location.search);
  const extractedId = (searchParams.get("data") || "").split("-")[0] || "unknown";
  const { player, skillsVisible } = parseSoccerProfile(
    table,
    playerInfo,
    getCurrentSeasonDay(),
    extractedId
  );

  // Any player, other teams' included - the only history source for them. An
  // unscouted player still gives an OR-only day.
  const teamId = getPlayerTeamId();
  captureSoccerPlayers([player], "PlayerProfile", {
    ownSquad: false,
    teamId: teamId !== "unknown" ? teamId : undefined,
  });

  if (!skillsVisible) return new Error("Player is not scouted or is not on the market");

  const contentColumn = document.querySelector(".column_left");

  // If content column is not found, return
  if (!contentColumn) return new Error("Content column not found");

  const sidebarContainer = document.createElement("div");
  sidebarContainer.id = "ppm-assistant-soccer-sidebar";
  contentColumn.appendChild(sidebarContainer);

  const sidebarApp = createApp(SoccerPlayerSidebar, { player });
  sidebarApp.mount(sidebarContainer);

  // Right below the profile box, full column width - the table's own column
  // (.profile_player_center) is too narrow for the chart. Same layout as
  // basketball's profile.
  const chartContainer = document.createElement("div");
  chartContainer.id = "ppm-assistant-soccer-chart";
  const profileBox = table.closest(".white_box");
  const profileCenter = document.querySelector(".profile_player_center");
  if (profileBox) profileBox.after(chartContainer);
  else if (profileCenter) profileCenter.appendChild(chartContainer);
  else return new Error("Profile center not found");

  const chartApp = createApp(SoccerPlayerGrowthChart, { player });
  chartApp.mount(chartContainer);
};

export default viewPlayerProfile;
