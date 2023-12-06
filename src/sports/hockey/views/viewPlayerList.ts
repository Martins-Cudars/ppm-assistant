import {
  positionSettings,
  ratingSettings,
  playerGrowthPrediction,
} from "@/sports/hockey/settings";
import {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
} from "@/base/calculations";
import {
  renderTableCell,
  renderComparison,
  renderRelativeSkill,
  renderButton,
} from "@/base/render";
import {
  getCurrentSeasonDay,
  recalculatePredictDataAccordingToSeasonDay,
} from "@/utils";

const viewPlayerList = () => {
  const mainContent = document.getElementsByClassName("main_content");
  const table = document.getElementById("table-1");

  if (!table) {
    return new Error("Table with id 'table-1' not found");
  }

  /** Calculate predictions */
  const seasonDay = getCurrentSeasonDay();
  const predictData = recalculatePredictDataAccordingToSeasonDay(
    playerGrowthPrediction,
    undefined,
    seasonDay
  );

  const tableHeads = table.querySelectorAll("thead");
  const tableBody = table.querySelector("tbody");

  const playerRows = tableBody!.querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr")!.appendChild(renderTableCell("Pos", "th1"));
    head.querySelector("tr")!.appendChild(renderTableCell("Skill", "th2"));
    head.querySelector("tr")!.appendChild(renderTableCell("Rating", "th1"));
    head.querySelector("tr")!.appendChild(renderTableCell("Relative", "th2"));
  });

  playerRows.forEach((playerRow, index) => {
    const playerColumns = playerRow.querySelectorAll("td");
    playerRow.classList.add(`player-row`);

    const player = {
      name: playerColumns[0].textContent,
      age: parseInt(playerColumns[2].textContent!),
      careerLongitivity: parseInt(Array.from(playerColumns[5].textContent!)[0]),
      skills: {
        goalie: parseInt(playerColumns[6].textContent!),
        defence: parseInt(playerColumns[7].textContent!),
        offence: parseInt(playerColumns[8].textContent!),
        shooting: parseInt(playerColumns[9].textContent!),
        passing: parseInt(playerColumns[10].textContent!),
        technical: parseInt(playerColumns[11].textContent!),
        aggression: parseInt(playerColumns[12].textContent!),
      },

      experience: parseInt(playerColumns[13].textContent!),
      overall: parseInt(playerColumns[14].textContent!),
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

  const filterByPositions = (pos: string) => {
    if (pos === "All") {
      tableBody!.querySelectorAll(".player-row").forEach((row: Element) => {
        (row as HTMLElement).style.display = "table-row";
      });
      return;
    }

    tableBody!.querySelectorAll(".player-row").forEach((row: Element) => {
      (row as HTMLElement).style.display = "none";
    });

    tableBody!
      .querySelectorAll(`.position-${pos.toLowerCase()}`)
      .forEach((row: Element) => {
        (row as HTMLElement).style.display = "table-row";
      });
  };

  const positionFilter = document.createElement("div");
  positionFilter.classList.add("position-filter");
  positionFilter.classList.add("white_box");

  const positionButtonAll = renderButton(`All (${playerRows.length})`);
  positionButtonAll.addEventListener("click", () => filterByPositions("All"));
  positionFilter.append(positionButtonAll);

  positionSettings.forEach((pos) => {
    const positionButton = renderButton(
      `${pos.name} (${
        document.querySelectorAll(`.position-${pos.name.toLowerCase()}`).length
      })`
    );
    positionButton.addEventListener("click", () => filterByPositions(pos.name));
    positionFilter.append(positionButton);
  });

  mainContent[0].prepend(positionFilter);
};

export default viewPlayerList;
