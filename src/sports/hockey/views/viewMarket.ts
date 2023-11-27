import {
  positionSettings,
  ratingSettings,
  playerGrowthPrediction,
} from "@/sports/hockey/settings";

import {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
  calculatePositionsQualities,
  calculateBestPotential,
} from "@/base/calculations";
import {
  renderTableCell,
  renderComparison,
  renderPotentialBadge,
  renderRelativeSkill,
} from "@/base/render";
import {
  getCurrentSeasonDay,
  recalculatePredictDataAccordingToSeasonDay,
} from "@/utils";

/**
 * View Functions
 */

const viewMarket = () => {
  const table = document.getElementById("table-1");

  if (!table) {
    return new Error("Table with id 'table-1' not found");
  }

  const tableHeads = table.querySelectorAll("thead");
  const tableBody = table.querySelector("tbody");

  const playerRows = tableBody!.querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr")!.appendChild(renderTableCell("Pos", "th1"));
    head.querySelector("tr")!.appendChild(renderTableCell("Sk", "th2"));
    head.querySelector("tr")!.appendChild(renderTableCell("Rating", "th1"));
    head.querySelector("tr")!.appendChild(renderTableCell("Grd", "th2"));
    head.querySelector("tr")!.appendChild(renderTableCell("Rel", "th1"));
  });

  const seasonDay = getCurrentSeasonDay();

  const predictData = recalculatePredictDataAccordingToSeasonDay(
    playerGrowthPrediction,
    undefined,
    seasonDay
  );

  const getSkill = (cell: HTMLTableCellElement) => {
    return parseInt(
      Array.from(cell.childNodes).reduce((a: string, b: ChildNode) => {
        return a + (b.nodeType === 3 ? b.textContent || "" : "");
      }, "")
    );
  };

  playerRows.forEach((playerRow, index) => {
    const playerColumns = playerRow.querySelectorAll("td");
    const playerQualities = playerRow.querySelectorAll(".kva");

    const player = {
      name: playerColumns[0].textContent,
      age: parseInt(playerColumns[1].textContent!),
      careerLongitivity: Array.from(playerColumns[4].textContent!)[0],
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
        goalie: parseInt(playerQualities[0].textContent!),
        defence: parseInt(playerQualities[1].textContent!),
        offence: parseInt(playerQualities[2].textContent!),
        shooting: parseInt(playerQualities[3].textContent!),
        passing: parseInt(playerQualities[4].textContent!),
        technical: parseInt(playerQualities[5].textContent!),
        aggression: parseInt(playerQualities[6].textContent!),
      },
      experience: parseInt(playerColumns[12].textContent!),
      overall: parseInt(playerColumns[13].textContent!),
    };

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

    const relativeCell = document.createElement("td");

    // Goalies only need 2 skill points per ability compared to other positions which need 2.5 skill points per ability
    const skillRecalculated =
      bestPosition.position === "G"
        ? bestSkillWithExp / 1.25
        : bestSkillWithExp;

    const relativeSkill = renderRelativeSkill(
      player.age,
      skillRecalculated,
      predictData
    );
    relativeCell.classList.add(`${rowClass}td2`);
    relativeCell.appendChild(relativeSkill);

    playerRow.appendChild(relativeCell);
  });
};

export default viewMarket;
