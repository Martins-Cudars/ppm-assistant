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
    head.querySelector("tr").appendChild(renderTableCell("TRN", "th2"));
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
      careerLongitivity: Array.from(playerColumns[4].textContent)[0],
      skills: {
        goalie: getSkill(playerColumns[5]),
        defence: getSkill(playerColumns[6]),
        offence: getSkill(playerColumns[7]),
        shooting: getSkill(playerColumns[8]),
        passing: getSkill(playerColumns[9]),
        technical: getSkill(playerColumns[10]),
        aggression: getSkill(playerColumns[11]),
      },
      qualities: {
        goalie: parseInt(playerQualities[0].textContent),
        defence: parseInt(playerQualities[1].textContent),
        offence: parseInt(playerQualities[2].textContent),
        shooting: parseInt(playerQualities[3].textContent),
        passing: parseInt(playerQualities[4].textContent),
        technical: parseInt(playerQualities[5].textContent),
        aggression: parseInt(playerQualities[6].textContent),
      },
      experience: parseInt(playerColumns[12].textContent),
      overall: playerColumns[13].textContent,
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

    playerRow.appendChild(renderTableCell(bestSkillWithExp, `${rowClass}td2`));

    const ratingTd = document.createElement("td");
    ratingTd.classList.add(`${rowClass}td1`);
    ratingTd.appendChild(renderComparison(bestSkillWithExp));

    playerRow.appendChild(ratingTd);

    const bestPotential = calculateBestPotential(
      calculatePositionsQualities(player)
    );

    const potentialBadge = renderPotentialBadge(
      bestPotential.potential,
      "small"
    );

    const potentialTd = document.createElement("td");
    potentialTd.classList.add(`${rowClass}td2`);
    potentialTd.appendChild(potentialBadge);

    playerRow.appendChild(potentialTd);
  });
};

export default viewMarket;
