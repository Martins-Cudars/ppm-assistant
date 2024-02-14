import { positionSettings } from "@/sports/soccer/settings";

import {
  calculatePositionsQualities,
  calculatePositionsSkills,
  calculateBestPosition,
} from "@/base/calculations";

import { renderTableCell, renderPotentialBadge } from "@/base/render";

const extractSkill = (el) => {
  const qualityElStart = el.innerHTML.indexOf('<span class="kva">');
  return parseInt(el.innerHTML.slice(0, qualityElStart).replace(/^\D+/g, ""));
};

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

    const playerQualities = playerRow.querySelectorAll(".kva");
    const playerColumns = playerRow.querySelectorAll("td");

    const player = {
      skills: {
        goalie: parseInt(playerColumns[6].textContent!),
        defence: parseInt(playerColumns[7].textContent!),
        midfield: parseInt(playerColumns[8].textContent!),
        offence: parseInt(playerColumns[9].textContent!),
        shooting: parseInt(playerColumns[10].textContent!),
        passing: parseInt(playerColumns[11].textContent!),
        technical: parseInt(playerColumns[12].textContent!),
        speed: parseInt(playerColumns[13].textContent!),
        heading: parseInt(playerColumns[14].textContent!),
      },
      qualities: {
        goalie: parseInt(playerQualities[0].textContent!),
        defence: parseInt(playerQualities[1].textContent!),
        midfield: parseInt(playerQualities[2].textContent!),
        offence: parseInt(playerQualities[3].textContent!),
        shooting: parseInt(playerQualities[4].textContent!),
        passing: parseInt(playerQualities[5].textContent!),
        technical: parseInt(playerQualities[6].textContent!),
        speed: parseInt(playerQualities[7].textContent!),
        heading: parseInt(playerQualities[8].textContent!),
      },
    };

    const playerPositions = calculatePositionsSkills(player, positionSettings);
    const bestPosition = calculateBestPosition(playerPositions);
    const potentials = calculatePositionsQualities(player, positionSettings);

    const bestPotential = potentials.find(
      (el) => el.position === bestPosition.position
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
