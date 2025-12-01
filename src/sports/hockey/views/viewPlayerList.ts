import { createApp } from "vue";
import { createPinia } from "pinia";
import PlayerListTable from "./components/PlayerListTable.vue";
import { usePlayerStore } from "@/stores/playerStore";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";

const viewPlayerList = () => {
  const table = document.getElementById("table-1");

  if (!table) {
    return new Error("Table with id 'table-1' not found");
  }

  const tableBody = table.querySelector("tbody");
  const playerRows = tableBody!.querySelectorAll("tr");
  const players: HockeyPlayer[] = [];

  playerRows.forEach((playerRow) => {
    const playerColumns = playerRow.querySelectorAll("td");

    const player = new HockeyPlayer(
      {
        id: "unknown",
        name: playerColumns[0].textContent!,
        age: parseInt(playerColumns[2].textContent!),
        careerLongitivity: parseInt(
          Array.from(playerColumns[5].textContent!)[0]
        ) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        overallRating: parseInt(playerColumns[14].textContent!),
        averageTrainingRatio: 0,
        preferredSide: "U",
      },
      new Date(),
      false,
      true,
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
