import { positionSettings, ratingSettings } from "../settings";
import { calculatePositionsSkills } from "../calculations/positionsSkills";
import {
  calculateBestPosition,
  calculateSkillWithExp,
} from "~/src/calculations.js";
import {
  renderTableCell,
  renderComparison,
  renderButton,
} from "~/src/render.js";

const viewPlayerList = () => {
  console.log("viewPlayerList");

  const mainContent = document.getElementsByClassName("main_content");

  const tableHeads = document
    .getElementById("table-1")!
    .querySelectorAll("thead");

  const playerRows = document
    .getElementById("table-1")!
    .querySelector("tbody")!
    .querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr")!.appendChild(renderTableCell("POS", "th1"));
    head.querySelector("tr")!.appendChild(renderTableCell("SK", "th2"));
    head.querySelector("tr")!.appendChild(renderTableCell("RATING", "th1"));
  });

  playerRows.forEach((playerRow, index) => {
    const playerColumns = playerRow.querySelectorAll("td");
    playerRow.classList.add(`player-row`);

    const player = {
      name: playerColumns[0].textContent,
      age: playerColumns[4].textContent,
      careerLongitivity: Array.from(playerColumns[7].textContent)[0],
      skills: {
        shooting: parseInt(playerColumns[8].textContent),
        blocking: parseInt(playerColumns[9].textContent),
        passing: parseInt(playerColumns[10].textContent),
        technical: parseInt(playerColumns[11].textContent),
        speed: parseInt(playerColumns[12].textContent),
        aggression: parseInt(playerColumns[13].textContent),
        jumping: parseInt(playerColumns[14].textContent),
      },

      experience: parseInt(playerColumns[15].textContent),
      overall: parseInt(playerColumns[16].textContent),
      height: parseInt(playerColumns[17].textContent),
    };

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const skills = calculatePositionsSkills(player, positionSettings);
    const bestPosition = calculateBestPosition(skills);

    playerRow.classList.add(`position-${bestPosition.position.toLowerCase()}`);
    const bestSkillWithExp = calculateSkillWithExp(
      bestPosition.level,
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
