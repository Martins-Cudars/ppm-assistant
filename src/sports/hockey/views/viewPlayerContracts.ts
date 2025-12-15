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

  const container = document.createElement("div");
  table.parentNode?.insertBefore(container, table.nextSibling);

  createApp(PlayerContractsTable, {
    items,
    columns,
  }).mount(container);
};

export default viewPlayerContracts;
