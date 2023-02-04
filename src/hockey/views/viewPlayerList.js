import { positionSettings, ratingSettings } from "../settings";
import {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
} from "~/src/calculations.js";
import {
  renderTableCell,
  renderComparison,
  renderButton,
} from "~/src/render.js";

const viewPlayerList = () => {
  const mainContent = document.getElementsByClassName("main_content");

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
    playerRow.classList.add(`player-row`);

    const player = {
      name: playerColumns[0].textContent,
      age: playerColumns[2].textContent,
      careerLongitivity: Array.from(playerColumns[5].textContent)[0],
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

  const filterByPositions = (pos) => {
    if (pos === "All") {
      document.querySelectorAll(".player-row").forEach((row) => {
        row.style.display = "table-row";
      });
      return;
    }

    document.querySelectorAll(".player-row").forEach((row) => {
      row.style.display = "none";
    });

    document
      .querySelectorAll(`.position-${pos.toLowerCase()}`)
      .forEach((row) => {
        row.style.display = "table-row";
      });
  };

  const positionFilter = document.createElement("div");
  positionFilter.classList.add("position-filter");
  positionFilter.classList.add("white_box");

  const positionButtonAll = renderButton("All");
  const positionButtonW = renderButton("W");
  const positionButtonC = renderButton("C");
  const positionButtonD = renderButton("D");
  const positionButtonG = renderButton("G");

  positionButtonAll.addEventListener("click", () => filterByPositions("All"));
  positionButtonW.addEventListener("click", () => filterByPositions("W"));
  positionButtonC.addEventListener("click", () => filterByPositions("C"));
  positionButtonD.addEventListener("click", () => filterByPositions("D"));
  positionButtonG.addEventListener("click", () => filterByPositions("G"));

  positionFilter.append(positionButtonAll);
  positionFilter.append(positionButtonW);
  positionFilter.append(positionButtonC);
  positionFilter.append(positionButtonD);
  positionFilter.append(positionButtonG);

  mainContent[0].prepend(positionFilter);
};

export default viewPlayerList;
