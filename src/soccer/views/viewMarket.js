import { positionSettings, ratingSettings } from "../settings";
import {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
  calculatePositionsQualities,
  calculateBestPotential,
} from "~/src/calculations.js";
import {
  renderTableCell,
  renderComparison,
  renderPotentialBadge,
} from "~/src/render.js";

/**
 * View Functions
 */

const viewMarket = () => {
  console.log("viewMarket");
  const tableHeads = document
    .getElementById("table-1")
    .querySelectorAll("thead");

  const playerRows = document
    .getElementById("table-1")
    .querySelector("tbody")
    .querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr").appendChild(renderTableCell("Pos", "th1"));
    head.querySelector("tr").appendChild(renderTableCell("Sk", "th2"));
    head.querySelector("tr").appendChild(renderTableCell("Rating", "th1"));
    head.querySelector("tr").appendChild(renderTableCell("Grd", "th2"));
  });

  const getSkill = (column) => {
    return parseInt(
      [].reduce.call(
        column.childNodes,
        (a, b) => {
          return a + (b.nodeType === 3 ? b.textContent : "");
        },
        ""
      )
    );
  };

  playerRows.forEach((playerRow, index) => {
    const playerColumns = playerRow.querySelectorAll("td");
    const playerQualities = playerRow.querySelectorAll(".kva");

    const player = {
      name: playerColumns[0].textContent,
      age: playerColumns[1].textContent,
      careerLongitivity: Array.from(playerColumns[3].textContent)[0],
      skills: {
        goalie: getSkill(playerColumns[4]),
        defence: getSkill(playerColumns[5]),
        midfield: getSkill(playerColumns[6]),
        offence: getSkill(playerColumns[7]),
        shooting: getSkill(playerColumns[8]),
        passing: getSkill(playerColumns[9]),
        technical: getSkill(playerColumns[10]),
        speed: getSkill(playerColumns[11]),
        heading: getSkill(playerColumns[11]),
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
        heading: parseInt(playerQualities[7].textContent),
      },
      experience: parseInt(playerColumns[13].textContent),
      overall: playerColumns[14].textContent,
    };

    console.log(player);

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const skills = calculatePositionsSkills(player, positionSettings);
    const bestPosition = calculateBestPosition(skills);
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

    const bestPotential = calculateBestPotential(
      calculatePositionsQualities(player, positionSettings)
    );

    const potentialBadge = renderPotentialBadge(
      bestPotential.potential,
      "small"
    );

    const potentialTd = document.createElement("td");
    potentialTd.classList.add(`${rowClass}td2`);
    potentialTd.classList.add("td-center");
    potentialTd.appendChild(potentialBadge);

    playerRow.appendChild(potentialTd);
  });
};

export default viewMarket;
