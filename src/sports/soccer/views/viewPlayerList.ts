import {
  positionSettings,
  ratingSettings,
  playerGrowthPrediction,
} from "@/sports/soccer/settings";
import {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
} from "@/base/calculations";
import {
  renderTableCell,
  renderComparison,
  renderButton,
  renderRelativeSkill,
} from "@/base/render";
import {
  getCurrentSeasonDay,
  recalculatePredictDataAccordingToSeasonDay,
} from "@/utils";
import { SoccerPlayer } from "@/types/Player";

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

  const playerRows = table.querySelector("tbody")!.querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr")!.appendChild(renderTableCell("POS", "th1"));
    head.querySelector("tr")!.appendChild(renderTableCell("SK", "th2"));
    head.querySelector("tr")!.appendChild(renderTableCell("RATING", "th1"));
    head.querySelector("tr")!.appendChild(renderTableCell("Relative", "th2"));
  });

  playerRows.forEach((playerRow, index) => {
    const playerColumns = playerRow.querySelectorAll("td");
    playerRow.classList.add(`player-row`);

    const player: SoccerPlayer = {
      name: playerColumns[0].textContent!,
      age: parseInt(playerColumns[2].textContent!),
      careerLongitivity: parseInt(Array.from(playerColumns[5].textContent!)[0]),
      skills: {
        goalie: parseInt(playerColumns[6].textContent!),
        defence: parseInt(playerColumns[7].textContent!),
        midfield: parseInt(playerColumns[8].textContent!),
        offence: parseInt(playerColumns[9].textContent!),
        shooting: parseInt(playerColumns[10].textContent!),
        passing: parseInt(playerColumns[11].textContent!),
        technical: parseInt(playerColumns[12].textContent!),
        speed: parseInt(playerColumns[13].textContent!),
        heading: parseInt(playerColumns[14].textContent!),
      },

      experience: parseInt(playerColumns[15].textContent!),
      overall: parseInt(playerColumns[16].textContent!),
    };

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const skills = calculatePositionsSkills(player, positionSettings);
    const bestPosition = calculateBestPosition(skills);
    playerRow.classList.add(`position-${bestPosition.position.toLowerCase()}`);

    const bestSkillWithExp = calculateSkillWithExp(
      bestPosition.level,
      player.experience
    );

    playerRow.classList.add(`pos-${bestPosition.position.toLowerCase()}`);

    playerRow.appendChild(
      renderTableCell(bestPosition.position, `${rowClass}td1`)
    );

    playerRow.appendChild(renderTableCell(bestSkillWithExp, `${rowClass}td2`));

    const ratingTd = document.createElement("td");
    ratingTd.classList.add(`${rowClass}td1`);
    ratingTd.appendChild(renderComparison(bestSkillWithExp, ratingSettings));

    playerRow.appendChild(ratingTd);

    const relativeCell = document.createElement("td");

    const relativeSkill = renderRelativeSkill(
      player.age,
      bestSkillWithExp,
      predictData
    );
    relativeCell.classList.add(`${rowClass}td2`);
    relativeCell.appendChild(relativeSkill);

    playerRow.appendChild(relativeCell);
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
