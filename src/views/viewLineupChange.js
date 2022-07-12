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
        goalie: playerColumns[6].textContent,
        defence: playerColumns[7].textContent,
        offence: playerColumns[8].textContent,
        shooting: playerColumns[9].textContent,
        passing: playerColumns[10].textContent,
        technical: playerColumns[11].textContent,
        aggression: playerColumns[12].textContent,
      },
      experience: parseInt(playerColumns[13].textContent),
      overall: playerColumns[14].textContent,
    };

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const skills = calculatePositionsSkills(player);
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
    ratingTd.appendChild(renderComparison(bestSkillWithExp));

    playerRow.appendChild(ratingTd);
  });
};

export default viewLineupChange;
