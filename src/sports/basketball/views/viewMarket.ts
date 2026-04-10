import { ratingSettings } from "@/sports/basketball/settings";
import { parseBasketballPlayerFromMarketRow } from "@/sports/basketball/parsers/playerRows";
import {
  renderTableCell,
  renderComparison,
  renderPotentialBadge,
} from "@/base/render";

const viewMarket = () => {
  const table = document.getElementById("table-1");
  if (!table) {
    console.error("Table with id 'table-1' not found");
    return;
  }

  const tableHeads = table.querySelectorAll("thead");
  const tableFoots = table.querySelectorAll("tfoot");
  const playerRows = table.querySelector("tbody")?.querySelectorAll("tr");

  tableHeads.forEach((head) => {
    const row = head.querySelector("tr");

    if (row) {
      row.appendChild(renderTableCell("POS", "th1"));
      row.appendChild(renderTableCell("SK", "th2"));
      row.appendChild(renderTableCell("RATING", "th1"));
      row.appendChild(renderTableCell("TRN", "th2"));
    }
  });

  tableFoots.forEach((foot) => {
    const row = foot.querySelector("tr");

    if (row) {
      row.appendChild(renderTableCell("POS", "th1"));
      row.appendChild(renderTableCell("SK", "th2"));
      row.appendChild(renderTableCell("RATING", "th1"));
      row.appendChild(renderTableCell("TRN", "th2"));
    }
  });

  playerRows?.forEach((playerRow, index) => {
    playerRow.classList.add(`player-row`);
    const player = parseBasketballPlayerFromMarketRow(playerRow);
    player.calculatePositions();
    player.calculatePositionTrainingQualities();

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const bestPosition = player.getBestPosition();
    const bestPotential = player.getCurrentPositionTrainingQuality();

    playerRow.classList.add(`position-${bestPosition.name.toLowerCase()}`);

    playerRow.appendChild(
      renderTableCell(bestPosition.name, `${rowClass}td1`)
    );

    playerRow.appendChild(renderTableCell(bestPosition.ratingWithXp, `${rowClass}td2`));

    const ratingTd = document.createElement("td");
    ratingTd.classList.add(`${rowClass}td1`);
    ratingTd.appendChild(renderComparison(bestPosition.ratingWithXp, ratingSettings));
    playerRow.appendChild(ratingTd);
    const potentialBadge = renderPotentialBadge(bestPotential.totalTrainingQuality, "small");

    const potentialTd = document.createElement("td");
    potentialTd.classList.add(`${rowClass}td2`);
    potentialTd.classList.add("td-center");
    potentialTd.appendChild(potentialBadge);

    playerRow.appendChild(potentialTd);
  });
};

export default viewMarket;
