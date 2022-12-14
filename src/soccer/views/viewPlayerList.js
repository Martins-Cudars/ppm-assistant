import { positionSettings, ratingSettings } from "../settings";
import {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
} from "~/src/calculations.js";
import { renderTableCell, renderComparison } from "~/src/render.js";

const viewPlayerList = () => {
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
      name: playerColumns[0].textContent,
      age: playerColumns[2].textContent,
      careerLongitivity: Array.from(playerColumns[5].textContent)[0],
      skills: {
        goalie: playerColumns[6].textContent,
        defence: playerColumns[7].textContent,
        midfield: playerColumns[8].textContent,
        offence: playerColumns[9].textContent,
        shooting: playerColumns[10].textContent,
        passing: playerColumns[11].textContent,
        technical: playerColumns[12].textContent,
        speed: playerColumns[13].textContent,
        heading: playerColumns[14].textContent,
      },

      experience: parseInt(playerColumns[15].textContent),
      overall: playerColumns[16].textContent,
    };

    console.log(player);

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

    playerRow.appendChild(renderTableCell(bestSkillWithExp, `${rowClass}td2`));

    const ratingTd = document.createElement("td");
    ratingTd.classList.add(`${rowClass}td1`);
    ratingTd.appendChild(renderComparison(bestSkillWithExp, ratingSettings));

    playerRow.appendChild(ratingTd);
  });
};

export default viewPlayerList;
