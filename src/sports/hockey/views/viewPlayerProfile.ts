import { createApp } from "vue";
import { createPinia } from "pinia";
import {
  HockeyPlayer,
  HockeyPlayerInfo,
} from "@/sports/hockey/classes/HockeyPlayer";
import PlayerSidebar from "./components/PlayerSidebar.vue";
import PlayerGrowthChart from "./components/PlayerGrowthChart.vue";
import { getCurrentSeasonDay, getPlayerTeamId, getTeamNameFromPlayerProfile } from "@/utils/dom";
import { collectPlayerData } from "@/services/dataCollector";
import { saveUserSettings } from "@/storage/userSettings";
import { extractLangFromUrl } from "@/utils/parsers";
import { getPlayerPageForLang } from "@/sports/hockey/routes";

const viewPlayerProfile = () => {
  const seasonDay = getCurrentSeasonDay();
  const teamId = getPlayerTeamId();
  const teamName = getTeamNameFromPlayerProfile();

  const lang = extractLangFromUrl(window.location.pathname);
  saveUserSettings({
    lang,
    sport: "hockey",
    playerPage: getPlayerPageForLang(lang),
  });

  const playerTable = document.getElementById("table-1");
  const playerInfo = document.querySelector(".player_info");

  // If player table is not found, return
  if (!playerTable) return new Error("Player table not found");
  if (!playerInfo) return new Error("Player info not found");

  const playerScouted = document
    .querySelector(".player_info")
    ?.querySelector("img[src*='scouted_yes.png']")
    ? true
    : false;
  const skillsVisible = playerTable.querySelector("#goalie") ? true : false; // If goalie stat is found, player data is visible

  const searchParams = new URLSearchParams(window.location.search);
  const dataParam = searchParams.get("data") || "";
  const extractedId = dataParam.split("-")[0];

  const baseInfo: HockeyPlayerInfo = {
    id: extractedId,
    name: playerInfo.querySelector(".link_name")!.textContent!,
    age: parseInt(playerTable.querySelector("#age")!.textContent!),
    careerLongitivity: parseInt(
      Array.from(playerTable.querySelector("#life_time span")!.textContent!)[0]
    ) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    overallRating: parseInt(
      playerTable.querySelector("#index_skill")!.textContent!
    ),
    averageTrainingRatio: parseInt(
      playerTable.querySelector("#prk")!.textContent!
    ),
    preferredSide: "U",
    teamId: teamId !== "unknown" ? teamId : undefined,
    teamName: teamName !== "unknown" ? teamName : undefined,
  };

  const skills = skillsVisible
    ? {
        goalie: parseInt(playerTable.querySelector("#goalie")!.textContent!),
        defence: parseInt(playerTable.querySelector("#defense")!.textContent!),
        offence: parseInt(playerTable.querySelector("#attack")!.textContent!),
        shooting: parseInt(
          playerTable.querySelector("#shooting")!.textContent!
        ),
        passing: parseInt(playerTable.querySelector("#passing")!.textContent!),
        technical: parseInt(
          playerTable.querySelector("#technique_attribute")!.textContent!
        ),
        aggression: parseInt(
          playerTable.querySelector("#aggressive")!.textContent!
        ),
      }
    : undefined;

  const experience = skillsVisible
    ? parseInt(playerTable.querySelector("#experience")!.textContent!)
    : undefined;

  const trainingQualities = skillsVisible
    ? {
        goalie: parseInt(
          playerTable.querySelector("#kva_goalie")!.textContent!
        ),
        defence: parseInt(
          playerTable.querySelector("#kva_defense")!.textContent!
        ),
        offence: parseInt(
          playerTable.querySelector("#kva_attack")!.textContent!
        ),
        shooting: parseInt(
          playerTable.querySelector("#kva_shooting")!.textContent!
        ),
        passing: parseInt(
          playerTable.querySelector("#kva_passing")!.textContent!
        ),
        technical: parseInt(
          playerTable.querySelector("#technique_quality")!.textContent!
        ),
        aggression: parseInt(
          playerTable.querySelector("#kva_aggressive")!.textContent!
        ),
      }
    : undefined;

  // Extract contract information from the table_info div
  // Structure: div.table_info contains 4 divs with class "five"
  // Order: [0] Salary, [1] Contract Days, [2] ALP, [3] Days in Team
  // Each div contains: Label<br><strong>Value</strong>

  const tableInfoDiv = document.querySelector('.table_info');

  if (tableInfoDiv) {
    const children = Array.from(tableInfoDiv.children);

    if (children.length >= 4) {
      // Extract values from <strong> tags
      const salaryStrong = children[0].querySelector('strong');
      const contractDaysStrong = children[1].querySelector('strong');
      const alpStrong = children[2].querySelector('strong');
      const daysInTeamStrong = children[3].querySelector('strong');

      const salaryValue = salaryStrong
        ? parseInt(salaryStrong.textContent?.replace(/\s/g, '') || '0')
        : undefined;

      const contractDaysValue = contractDaysStrong
        ? parseInt(contractDaysStrong.textContent?.replace(/\s/g, '') || '0')
        : undefined;

      const daysInTeamValue = daysInTeamStrong
        ? parseInt(daysInTeamStrong.textContent?.replace(/\s/g, '') || '0')
        : undefined;

      // ALP can be "jā/nē" (Latvian), "yes/no" (English), or similar
      const alpText = alpStrong?.textContent?.toLowerCase() || '';
      const alpEnabled = alpText.includes('jā') || alpText.includes('yes') ? true :
                         alpText.includes('nē') || alpText.includes('no') ? false :
                         undefined;

      baseInfo.contract = {
        salary: salaryValue,
        contractDays: contractDaysValue,
        daysInTeam: daysInTeamValue,
        autoRenewal: alpEnabled,
      };

      console.log('[PlayerProfile] Contract data extracted:', baseInfo.contract);
    }
  }

  const player = new HockeyPlayer(
    baseInfo,
    new Date(),
    playerScouted ? "SCOUTED" : "UNSCOUTED",  // Convert boolean to ScoutingStatus
    skillsVisible,
    seasonDay,
    skills,
    experience,
    trainingQualities
  );

  player.calculatePositions();
  player.calculatePositionTrainingQualities();

  // Collect and cache player data
  collectPlayerData(player, "PlayerProfile");

  console.log(player);

  /** Render Sidebar */
  const contentColumn = document.querySelector(".column_left");
  if (contentColumn) {
    const sidebarContainer = document.createElement("div");
    sidebarContainer.id = "ppm-assistant-sidebar";
    contentColumn.appendChild(sidebarContainer);

    const sidebarApp = createApp(PlayerSidebar, { player });
    const pinia = createPinia();
    sidebarApp.use(pinia);
    sidebarApp.mount(sidebarContainer);
  }

  /** Render Chart */
  // Create a container for the chart after the player table
  const chartContainer = document.createElement("div");
  chartContainer.id = "ppm-assistant-chart";

  const centerColumn = document.querySelector(".column_center_inner");
  if (centerColumn) {
    centerColumn.appendChild(chartContainer);
  } else if (playerTable.parentNode) {
    // Fallback if column_center_inner is not found
    playerTable.parentNode.appendChild(chartContainer);
  }

  const chartApp = createApp(PlayerGrowthChart, { player });
  chartApp.mount(chartContainer);
};

export default viewPlayerProfile;
