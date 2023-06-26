import { positionSettings } from "../settings";

import {
  calculatePositionsQualities,
  calculatePositionsSkills,
  calculateBestPosition,
} from "~/src/calculations.js";

import { renderTableCell, renderPotentialBadge } from "~/src/render";

const extractSkill = (el) => {
  const skill = el.querySelector("span:first-child");
  return parseInt(skill.textContent);
};

const viewTraining = () => {
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
    const playerColumns = playerRow.querySelectorAll("td");

    const player = {
      skills: {
        goalie: extractSkill(playerColumns[5]),
        defence: extractSkill(playerColumns[6]),
        midfield: extractSkill(playerColumns[7]),
        offence: extractSkill(playerColumns[8]),
        shooting: extractSkill(playerColumns[9]),
        passing: extractSkill(playerColumns[10]),
        technical: extractSkill(playerColumns[11]),
        speed: extractSkill(playerColumns[12]),
        heading: extractSkill(playerColumns[13]),
      },
      qualities: {
        goalie: parseInt(playerQualities[0].textContent),
        defence: parseInt(playerQualities[1].textContent),
        midfield: parseInt(playerQualities[2].textContent),
        offence: parseInt(playerQualities[3].textContent),
        shooting: parseInt(playerQualities[4].textContent),
        passing: parseInt(playerQualities[5].textContent),
        technical: parseInt(playerQualities[6].textContent),
        speed: parseInt(playerQualities[7].textContent),
        heading: parseInt(playerQualities[8].textContent),
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
