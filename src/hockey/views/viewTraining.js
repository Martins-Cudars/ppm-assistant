import { positionSettings } from "../settings";

import {
  calculatePositionsQualities,
  calculateBestPotential,
} from "~/src/calculations.js";

import { renderTableCell, renderPotentialBadge } from "~/src/render";

const viewTraining = () => {
  console.log("viewTraining");

  const tableHeads = document
    .getElementById("table-1")
    .querySelectorAll("thead");

  const playerRows = document
    .getElementById("table-1")
    .querySelector("tbody")
    .querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr").appendChild(renderTableCell("Grd", "th1"));
  });

  playerRows.forEach((playerRow, index) => {
    const rowClass = index % 2 === 0 ? "tr1" : "tr0";

    const playerQualities = playerRow.querySelectorAll(".kva");

    const player = {
      qualities: {
        goalie: parseInt(playerQualities[0].textContent),
        defence: parseInt(playerQualities[1].textContent),
        offence: parseInt(playerQualities[2].textContent),
        shooting: parseInt(playerQualities[3].textContent),
        passing: parseInt(playerQualities[4].textContent),
        technical: parseInt(playerQualities[5].textContent),
        aggression: parseInt(playerQualities[6].textContent),
      },
    };

    const bestPotential = calculateBestPotential(
      calculatePositionsQualities(player, positionSettings)
    );

    const potentialBadge = renderPotentialBadge(
      bestPotential.potential,
      "small"
    );
    const potentialTd = document.createElement("td");
    potentialTd.classList.add(`${rowClass}td1`);
    potentialTd.classList.add("td-center");
    potentialTd.appendChild(potentialBadge);

    playerRow.appendChild(potentialTd);
  });
};

export default viewTraining;
