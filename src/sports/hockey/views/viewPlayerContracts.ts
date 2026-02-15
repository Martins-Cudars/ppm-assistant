import { createApp } from "vue";
import PlayerContractsTable from "./components/PlayerContractsTable.vue";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { getCurrentSeasonDay } from "@/utils/dom";
import { collectBatchPlayerData } from "@/services/dataCollector";
import { getPlayer } from "@/storage/playerCache";

const viewPlayerContracts = async () => {
  const table = document.querySelector("#table-1");
  if (!table) return;

  const rows = table.querySelectorAll("tbody tr");
  const items: any[] = [];
  const players: HockeyPlayer[] = [];
  const seasonDay = getCurrentSeasonDay();

  // Process rows sequentially to handle async cache loading
  for (const row of rows) {
    const cells = row.querySelectorAll("td");

    // Default structure based on user example:
    // 0: Name (HTML)
    // 1: Age
    // 2: Contract (Days)
    // 3: Salary
    // 4: DK (Market Value)
    // 5: ALP (Auto-renew checkbox)

    if (cells.length < 6) continue;

    // Extract player ID from name link
    const nameLink = cells[0].querySelector("a.link_name") as HTMLAnchorElement;
    const id = nameLink?.href.split("data=")[1]?.split("-")[0] || "unknown";
    const name = nameLink?.textContent?.trim() || cells[0].textContent?.trim() || "Unknown";
    const age = parseInt(cells[1].textContent || "0");
    const contractDays = parseInt(cells[2].textContent || "0");
    const salary = parseInt(cells[3].textContent || "0");
    const daysInTeam = parseInt(cells[4].textContent || "0");

    // Extract ALP (auto-renewal) link info from last cell
    const alpCell = cells[5];
    const alpLink = alpCell.querySelector("a");
    const alpHref = alpLink?.getAttribute("href") || "";
    // Check for checkbox_mini_yes/checkbox_mini_no class to determine state
    const alpCheckbox = alpCell.querySelector("[class*='checkbox_mini']");
    const alpEnabled = alpCheckbox?.classList.contains("checkbox_mini_yes") || false;

    items.push({
      nameHtml: cells[0].innerHTML,
      age: age,
      contract: contractDays,
      salary: salary,
      daysInTeam: daysInTeam,
      alpEnabled,
      alpHref,
    });

    // Try to load existing player from cache
    if (id !== "unknown") {
      const existingPlayer = await getPlayer(id);

      if (existingPlayer) {
        // Enhance existing player with contract data
        existingPlayer.contract = {
          contractDays: contractDays,
          salary: salary,
          daysInTeam: daysInTeam,
          autoRenewal: alpEnabled,
        };
        existingPlayer.updatedAt = new Date();
        existingPlayer.seasonDay = seasonDay;
        players.push(existingPlayer);
      } else {
        // Create minimal player if no cache exists (fallback)
        const player = new HockeyPlayer(
          {
            id: id,
            name: name,
            age: age,
            careerLongitivity: 3, // Default - unknown from contracts view
            overallRating: 0, // Unknown from contracts view
            preferredSide: "U",
            contract: {
              contractDays: contractDays,
              salary: salary,
              daysInTeam: daysInTeam,
              autoRenewal: alpEnabled,
            },
          },
          new Date(),
          "UNSCOUTED", // Unknown from contracts view
          false,
          seasonDay,
          undefined, // No skills
          undefined, // No experience
          undefined, // No training qualities
          0 // No injury data in contracts view
        );
        players.push(player);
      }
    }
  }

  // Collect and cache minimal player data
  if (players.length > 0) {
    collectBatchPlayerData(players, "PlayerContracts");
  }

  const totalSalary = items.reduce((acc, item) => acc + item.salary, 0);

  const formatMoney = (val: number) => {
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  items.forEach((item) => {
    item.salaryPercentage = totalSalary
      ? ((item.salary / totalSalary) * 100).toFixed(1) + "%"
      : "0%";
    
    item.contractWorthRaw = item.salary * item.contract;
    item.contractWorth = formatMoney(item.contractWorthRaw);

    item.seasonSalaryRaw = item.salary * 112;
    item.seasonSalary = formatMoney(item.seasonSalaryRaw);
  });

  const columns = [
    {
      header: "Vārds",
      key: "name",
      slot: "name",
      align: "left",
      cellClass: "text-left",
    },
    { header: "Vecums", key: "age", sortable: true },
    { header: "Līgums", key: "contract", sortable: true },
    { header: "Alga", key: "salary", sortable: true },
    { header: "Alga %", key: "salaryPercentage", sortable: true },
    { header: "Līguma vērt.", key: "contractWorth", sortable: true, sortKey: "contractWorthRaw" },
    { header: "Sezonas alga", key: "seasonSalary", sortable: true, sortKey: "seasonSalaryRaw" },
    { header: "DK", key: "daysInTeam", sortable: true },
    { header: "ALP", key: "alp", slot: "alp" },
  ];

  // Original table is hidden via CSS (hide-table.css) loaded at document_start

  const container = document.createElement("div");
  table.parentNode?.insertBefore(container, table.nextSibling);

  createApp(PlayerContractsTable, {
    items,
    columns,
  }).mount(container);
};

export default viewPlayerContracts;
