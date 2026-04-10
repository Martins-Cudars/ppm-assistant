import { ratingSettings } from "@/sports/basketball/settings";
import { parseBasketballPlayerFromListRow } from "@/sports/basketball/parsers/playerRows";
import { renderTableCell, renderComparison } from "@/base/render";

const viewPlayerList = () => {
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
    }
  });

  tableFoots.forEach((foot) => {
    const row = foot.querySelector("tr");

    if (row) {
      row.appendChild(renderTableCell("POS", "th1"));
      row.appendChild(renderTableCell("SK", "th2"));
      row.appendChild(renderTableCell("RATING", "th1"));
    }
  });

  playerRows?.forEach((playerRow, index) => {
    playerRow.classList.add(`player-row`);
    const player = parseBasketballPlayerFromListRow(playerRow);
    player.calculatePositions();

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const bestPosition = player.getBestPosition();

    playerRow.classList.add(`position-${bestPosition.name.toLowerCase()}`);

    playerRow.appendChild(
      renderTableCell(bestPosition.name, `${rowClass}td1`)
    );

    playerRow.appendChild(renderTableCell(bestPosition.ratingWithXp, `${rowClass}td2`));

    const ratingTd = document.createElement("td");
    ratingTd.classList.add(`${rowClass}td1`);
    ratingTd.appendChild(renderComparison(bestPosition.ratingWithXp, ratingSettings));
    playerRow.appendChild(ratingTd);
  });
};

export default viewPlayerList;
