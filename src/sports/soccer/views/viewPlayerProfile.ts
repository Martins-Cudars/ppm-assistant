import { createApp } from "vue";
import { getCurrentSeasonDay } from "@/utils/dom";
import { SoccerPlayer } from "@/sports/soccer/classes/SoccerPlayer";
import SoccerPlayerSidebar from "./components/SoccerPlayerSidebar.vue";
import SoccerPlayerGrowthChart from "./components/SoccerPlayerGrowthChart.vue";

const viewPlayerProfile = () => {
  const table = document.getElementById("table-1");
  const playerInfo = document.querySelector(".player_info");

  if (!table) return new Error("Player table not found");
  if (!playerInfo) return new Error("Player info not found");

  const statsVisible = table.querySelector("#goalie") ? true : false; // If goalie stat is found, player is scouted

  if (!statsVisible)
    return new Error("Player is not scouted or is not on the market");

  const seasonDay = getCurrentSeasonDay();
  const searchParams = new URLSearchParams(window.location.search);
  const dataParam = searchParams.get("data") || "";
  const extractedId = dataParam.split("-")[0] || "unknown";

  const trainingQualities = {
    goalie: parseInt(table.querySelector("#kva_goalie")!.textContent!),
    defence: parseInt(table.querySelector("#kva_defense")!.textContent!),
    midfield: parseInt(table.querySelector("#kva_midfield")!.textContent!),
    offence: parseInt(table.querySelector("#kva_attack")!.textContent!),
    shooting: parseInt(table.querySelector("#kva_shooting")!.textContent!),
    passing: parseInt(table.querySelector("#kva_passing")!.textContent!),
    technical: parseInt(
      table.querySelector("#technique_quality")!.textContent!
    ),
    speed: parseInt(table.querySelector("#kva_speed")!.textContent!),
    heading: parseInt(table.querySelector("#kva_heading")!.textContent!),
  };

  const averageTrainingRatio = Math.round(
    Object.values(trainingQualities).reduce((sum, value) => sum + value, 0) /
      Object.values(trainingQualities).length
  );

  const player = new SoccerPlayer(
    {
      id: extractedId,
      name: playerInfo.querySelectorAll("a")[1]!.textContent!,
      age: parseInt(table.querySelector("#age")!.textContent!),
      careerLongitivity: parseInt(
        Array.from(table.querySelector("#life_time span")!.textContent!)[0]
      ) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      overallRating: parseInt(table.querySelector("#index_skill")!.textContent!),
      averageTrainingRatio,
    },
    new Date(),
    true,
    true,
    seasonDay,
    {
      goalie: parseInt(table.querySelector("#goalie")!.textContent!),
      defence: parseInt(table.querySelector("#defense")!.textContent!),
      midfield: parseInt(table.querySelector("#midfield")!.textContent!),
      offence: parseInt(table.querySelector("#attack")!.textContent!),
      shooting: parseInt(table.querySelector("#shooting")!.textContent!),
      passing: parseInt(table.querySelector("#passing")!.textContent!),
      technical: parseInt(
        table.querySelector("#technique_attribute")!.textContent!
      ),
      speed: parseInt(table.querySelector("#speed")!.textContent!),
      heading: parseInt(table.querySelector("#heading")!.textContent!),
    },
    parseInt(table.querySelector("#experience")!.textContent!),
    trainingQualities
  );
  player.calculatePositions();
  player.calculatePositionTrainingQualities();

  const contentColumn = document.querySelector(".column_left");

  // If content column is not found, return
  if (!contentColumn) return new Error("Content column not found");

  const sidebarContainer = document.createElement("div");
  sidebarContainer.id = "ppm-assistant-soccer-sidebar";
  contentColumn.appendChild(sidebarContainer);

  const sidebarApp = createApp(SoccerPlayerSidebar, { player });
  sidebarApp.mount(sidebarContainer);

  const profileCenter = document.querySelector(".profile_player_center");
  if (!profileCenter) return new Error("Profile center not found");

  const chartContainer = document.createElement("div");
  chartContainer.id = "ppm-assistant-soccer-chart";
  profileCenter.appendChild(chartContainer);

  const chartApp = createApp(SoccerPlayerGrowthChart, { player });
  chartApp.mount(chartContainer);
};

export default viewPlayerProfile;
