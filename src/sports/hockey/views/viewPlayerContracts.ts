import { createApp } from "vue";
import PlayerContractsTable from "./components/PlayerContractsTable.vue";

const viewPlayerContracts = () => {
  const table = document.querySelector("#table-1");
  if (!table) return;

  const rows = table.querySelectorAll("tbody tr");
  const items: any[] = [];

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    
    // Default structure based on user example:
    // 0: Name (HTML)
    // 1: Age
    // 2: Contract (Days)
    // 3: Salary
    // 4: DK (Market Value)
    // 5: ALP (Auto-renew checkbox)

    if (cells.length < 6) return;

    items.push({
      nameHtml: cells[0].innerHTML,
      age: parseInt(cells[1].textContent || "0"),
      contract: parseInt(cells[2].textContent || "0"),
      salary: parseInt(cells[3].textContent || "0"),
      daysInTeam: parseInt(cells[4].textContent || "0"),
    // ignoring checkbox for now
    });
  });

  const totalSalary = items.reduce((acc, item) => acc + item.salary, 0);

  items.forEach((item) => {
    item.salaryPercentage = totalSalary
      ? ((item.salary / totalSalary) * 100).toFixed(1) + "%"
      : "0%";
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
    { header: "DK", key: "daysInTeam", sortable: true },
    { header: "ALP", key: "alp", slot: "alp" },
  ];

  const container = document.createElement("div");
  table.parentNode?.insertBefore(container, table.nextSibling);

  createApp(PlayerContractsTable, {
    items,
    columns,
  }).mount(container);
};

export default viewPlayerContracts;
