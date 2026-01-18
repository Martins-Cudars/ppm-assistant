import { createApp } from "vue";
import { createPinia } from "pinia";
import PlayerListTable from "./components/PlayerListTable.vue";
import { usePlayerStore } from "@/stores/playerStore";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { getCurrentSeasonDay } from "@/utils";
import { collectBatchPlayerData } from "@/services/dataCollector";

const viewPlayerList = () => {
  const table = document.getElementById("table-1");

  if (!table) {
    return new Error("Table with id 'table-1' not found");
  }

  const tableBody = table.querySelector("tbody");
  const playerRows = tableBody!.querySelectorAll("tr");
  const players: HockeyPlayer[] = [];

  const seasonDay = getCurrentSeasonDay();

  playerRows.forEach((playerRow) => {
    const playerColumns = playerRow.querySelectorAll("td");

    const nameLink = playerColumns[0].querySelector(
      "a.link_name"
    ) as HTMLAnchorElement;
    const id = nameLink?.href.split("data=")[1]?.split("-")[0] || "unknown";
    const countryImg = playerColumns[0].querySelector(
      "img"
    ) as HTMLImageElement;
    const countryLinkElement = countryImg?.parentNode as HTMLAnchorElement;
    const countryLink = countryLinkElement?.href;

    const scoutingImg = playerColumns[3].querySelector("img");
    let scoutingStatus: "SCOUTED" | "IN_PROGRESS" | "UNSCOUTED" = "UNSCOUTED";

    if (scoutingImg) {
      const src = (scoutingImg as HTMLImageElement).src;
      if (src.includes("scouted_yes.png")) {
        scoutingStatus = "SCOUTED";
      } else if (src.includes("scouted_no.png")) {
        scoutingStatus = "IN_PROGRESS";
      }
    }

    // Parse injury
    let injuryDays = 0;
    const injuryImg = playerColumns[0].querySelector(
      'img[src*="day_to_day.png"], img[src*="injury"]'
    ) as HTMLImageElement;

    if (injuryImg) {
      console.log("Found injury image:", injuryImg.src, injuryImg.title);
      const match = injuryImg.title.match(/: (\d+)/);
      if (match) {
        injuryDays = parseInt(match[1]);
        console.log("Parsed injury days:", injuryDays);
      } else {
        console.log("Failed to parse injury days from title:", injuryImg.title);
      }
    } else {
      // Log innerHTML for debugging if we suspect it's there but missed
      if (
        playerColumns[0].innerHTML.includes("day_to_day") ||
        playerColumns[0].innerHTML.includes("injury")
      ) {
        console.log("Missed injury image in:", playerColumns[0].innerHTML);
      }
    }

    const player = new HockeyPlayer(
      {
        id: id,
        name: playerColumns[0].textContent!.trim(),
        age: parseInt(playerColumns[2].textContent!),
        careerLongitivity: parseInt(
          Array.from(playerColumns[5].textContent!)[0]
        ) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        overallRating: parseInt(
          playerColumns[14].textContent!.replace(/\D/g, "")
        ),
        averageTrainingRatio: parseInt(playerColumns[4].textContent!),
        preferredSide:
          (playerColumns[15].textContent?.trim() as "L" | "R" | "U") || "U",
        countryImage: countryImg?.src,
        countryLink: countryLink,
        teamPosition: playerColumns[1].textContent?.trim(),
      },
      new Date(),
      scoutingStatus,
      true,
      seasonDay,
      {
        goalie: parseInt(playerColumns[6].textContent!),
        defence: parseInt(playerColumns[7].textContent!),
        offence: parseInt(playerColumns[8].textContent!),
        shooting: parseInt(playerColumns[9].textContent!),
        passing: parseInt(playerColumns[10].textContent!),
        technical: parseInt(playerColumns[11].textContent!),
        aggression: parseInt(playerColumns[12].textContent!),
      },
      parseInt(playerColumns[13].textContent!),
      undefined,
      injuryDays
    );
    player.calculatePositions();
    players.push(player);
  });

  // Collect and cache all player data
  collectBatchPlayerData(players, "PlayersList");

  // Add button to open Full Player Table in new tab
  const fullTableButton = document.createElement("button");
  fullTableButton.textContent = "📊 View Full Player Table";
  fullTableButton.style.cssText = `
    margin-bottom: 15px;
    padding: 10px 20px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: background 0.2s;
  `;
  fullTableButton.onmouseover = () => {
    fullTableButton.style.background = "#0056b3";
  };
  fullTableButton.onmouseout = () => {
    fullTableButton.style.background = "#007bff";
  };
  fullTableButton.onclick = () => {
    const extensionUrl = chrome.runtime.getURL("full-player-table.html");
    window.open(extensionUrl, "_blank");
  };

  // Insert button before the table
  if (table.parentNode) {
    table.parentNode.insertBefore(fullTableButton, table);
  }

  // Create mount point
  const appContainer = document.createElement("div");
  appContainer.id = "ppm-assistant-app";

  // Replace original table to avoid conflicts
  if (table.parentNode) {
    table.parentNode.replaceChild(appContainer, table);
  } else {
    console.error("Table has no parent node");
    return;
  }

  try {
    const pinia = createPinia();
    const app = createApp(PlayerListTable);
    app.use(pinia);

    // Error handler
    app.config.errorHandler = (
      err: unknown,
      instance: unknown,
      info: string
    ) => {
      console.error("Vue Error:", err, info);
    };

    const store = usePlayerStore();
    store.setPlayers(players);

    // Extract headers
    const headerRow = table.querySelector("thead tr");
    const headers: string[] = [];
    if (headerRow) {
      const headerCells = headerRow.querySelectorAll("td");
      headerCells.forEach((cell) => {
        headers.push(cell.textContent?.trim() || "");
      });
    }
    store.setTableHeaders(headers);

    app.mount(appContainer);
  } catch (error) {
    console.error("Failed to mount Vue app:", error);
    // Restore table if failed
    if (appContainer.parentNode) {
      appContainer.parentNode.replaceChild(table, appContainer);
    }
  }
};

export default viewPlayerList;
