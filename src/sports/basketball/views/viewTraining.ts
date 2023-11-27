import { positionSettings } from "@/sports/basketball/settings";

import {
  calculatePositionsQualities,
  calculatePositionsSkills,
  calculateBestPosition,
} from "@/base/calculations";

import { renderTableCell, renderPotentialBadge } from "@/base/render";

const extractSkill = (cell: HTMLTableCellElement) => {
  const skill = cell.querySelector("span:first-child");
  return parseInt(skill!.textContent!);
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
        shooting: extractSkill(playerColumns[8]),
        blocking: extractSkill(playerColumns[9]),
        passing: extractSkill(playerColumns[10]),
        technical: extractSkill(playerColumns[11]),
        speed: extractSkill(playerColumns[12]),
        aggression: extractSkill(playerColumns[13]),
        jumping: extractSkill(playerColumns[14]),
      },
      qualities: {
        shooting: parseInt(playerQualities[0].textContent!),
        blocking: parseInt(playerQualities[1].textContent!),
        passing: parseInt(playerQualities[2].textContent!),
        technical: parseInt(playerQualities[3].textContent!),
        speed: parseInt(playerQualities[4].textContent!),
        aggression: parseInt(playerQualities[6].textContent!),
        jumping: parseInt(playerQualities[5].textContent!),
      },
    };

    const playerPositions = calculatePositionsSkills(player, positionSettings);
    const bestPosition = calculateBestPosition(playerPositions);
    const potentials = calculatePositionsQualities(player, positionSettings);

    const bestPotential = potentials.find(
      (el) => el.position === bestPosition.position
    );

    const potentialBadge = renderPotentialBadge(
      bestPotential!.potential,
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
