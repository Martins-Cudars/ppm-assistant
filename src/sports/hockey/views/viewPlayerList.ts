import { createApp } from "vue";
import { createPinia } from "pinia";
import PlayerListTable from "./components/PlayerListTable.vue";
import { usePlayerStore } from "@/stores/playerStore";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { getCurrentSeasonDay } from "@/utils";

const viewPlayerList = () => {
  const table = document.getElementById("table-1");

  if (!table) {
    return new Error("Table with id 'table-1' not found");
  }

  const tableBody = table.querySelector("tbody");
  const playerRows = tableBody!.querySelectorAll("tr");
  const players: HockeyPlayer[] = [];

  const seasonDay = getCurrentSeasonDay();
  console.log("Current Season Day:", seasonDay);

  playerRows.forEach((playerRow) => {
    const playerColumns = playerRow.querySelectorAll("td");

    const nameLink = playerColumns[0].querySelector(
      "a.link_name"
    ) as HTMLAnchorElement;
    const id = nameLink?.href.split("data=")[1] || "unknown";
    const countryImg = playerColumns[0].querySelector(
      "img"
    ) as HTMLImageElement;

    const isScouted = !!playerColumns[3].querySelector("img");

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
        teamPosition: playerColumns[1].textContent?.trim(),
      },
      new Date(),
      isScouted,
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
      parseInt(playerColumns[13].textContent!)
    );
    player.calculatePositions();
    players.push(player);
  });

  console.log(`Found ${players.length} players`);

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
    console.log("Extracted headers:", headers);
    store.setTableHeaders(headers);

    app.mount(appContainer);
    console.log("Vue app mounted successfully");
  } catch (error) {
    console.error("Failed to mount Vue app:", error);
    // Restore table if failed
    if (appContainer.parentNode) {
      appContainer.parentNode.replaceChild(table, appContainer);
    }
  }
};

export default viewPlayerList;
