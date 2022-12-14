import { positionSettings, ratingSettings } from "../settings";
import {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
} from "~/src/calculations.js";
import { renderTableCell, renderComparison } from "~/src/render.js";

const viewLineupChange = () => {
  const tableHeads = document
    .getElementById("table-1")
    .querySelectorAll("thead");

  const playerRows = document
    .getElementById("table-1")
    .querySelector("tbody")
    .querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr").appendChild(renderTableCell("POS", "th1"));
    head.querySelector("tr").appendChild(renderTableCell("SK", "th2"));
    head.querySelector("tr").appendChild(renderTableCell("RATING", "th1"));
  });

  playerRows.forEach((playerRow, index) => {
    const playerColumns = playerRow.querySelectorAll("td");

    const player = {
      name: playerColumns[2].textContent,
      skills: {
        goalie: playerColumns[playerColumns.length - 10].textContent,
        defence: playerColumns[playerColumns.length - 9].textContent,
        offence: playerColumns[playerColumns.length - 8].textContent,
        shooting: playerColumns[playerColumns.length - 7].textContent,
        passing: playerColumns[playerColumns.length - 6].textContent,
        technical: playerColumns[playerColumns.length - 5].textContent,
        aggression: playerColumns[playerColumns.length - 4].textContent,
      },
      experience: parseInt(playerColumns[playerColumns.length - 3].textContent),
    };

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const skills = calculatePositionsSkills(player, positionSettings);
    const bestPosition = calculateBestPosition(skills);
    const bestSkillWithExp = calculateSkillWithExp(
      bestPosition.skill,
      player.experience
    );

    playerRow.appendChild(
      renderTableCell(bestPosition.position, `${rowClass}td1`)
    );

    playerRow.appendChild(
      renderTableCell(
        calculateSkillWithExp(bestPosition.skill, player.experience),
        `${rowClass}td2`
      )
    );

    const ratingTd = document.createElement("td");
    ratingTd.classList.add(`${rowClass}td1`);
    ratingTd.appendChild(renderComparison(bestSkillWithExp, ratingSettings));

    playerRow.appendChild(ratingTd);
  });
};

export default viewLineupChange;
