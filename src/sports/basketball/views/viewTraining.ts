import { parseBasketballPlayerFromTrainingRow } from "@/sports/basketball/parsers/playerRows";
import { renderTableCell, renderPotentialBadge } from "@/base/render";

const viewTraining = () => {
  const tableHeads = document
    .getElementById("table-1")!
    .querySelectorAll("thead");

  const playerRows = document
    .getElementById("table-1")!
    .querySelector("tbody")!
    .querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr")!.appendChild(renderTableCell("Grd", "th1"));
  });

  playerRows.forEach((playerRow, index) => {
    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const player = parseBasketballPlayerFromTrainingRow(playerRow);
    player.calculatePositions();
    player.calculatePositionTrainingQualities();
    const bestPotential = player.getCurrentPositionTrainingQuality();
    const potentialBadge = renderPotentialBadge(bestPotential.totalTrainingQuality, "small");
    const potentialTd = document.createElement("td");
    potentialTd.classList.add(`${rowClass}td1`);
    potentialTd.classList.add("td-center");
    potentialTd.appendChild(potentialBadge);

    playerRow.appendChild(potentialTd);
  });
};

export default viewTraining;
