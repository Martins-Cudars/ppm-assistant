import {
  positionSettings,
  ratingSettings,
  playerGrowthPrediction,
} from "@/sports/hockey/settings";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
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

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";

    const player = new HockeyPlayer(
      {
        id: "unknown", // ID is not available in the table
        name: playerColumns[0].textContent!,
        age: parseInt(playerColumns[2].textContent!),
        careerLongitivity: parseInt(
          Array.from(playerColumns[5].textContent!)[0]
        ) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        overallRating: parseInt(playerColumns[14].textContent!),
        averageTrainingRatio: 0, // Not available in the table
        preferredSide: "U", // Not available in the table
      },
      new Date(),
      false,
      true,
      {
        goalie: parseInt(playerColumns[6].textContent!),
        defence: parseInt(playerColumns[7].textContent!),
        offence: parseInt(playerColumns[8].textContent!),
        shooting: parseInt(playerColumns[9].textContent!),
        passing: parseInt(playerColumns[10].textContent!),
        technical: parseInt(playerColumns[11].textContent!),
        aggression: parseInt(playerColumns[12].textContent!),
      },
      parseInt(playerColumns[13].textContent!)
    );

    player.calculatePositions();
    const bestPosition = player.getBestPosition();

    const predictData = recalculatePredictDataAccordingToSeasonDay(
      playerGrowthPrediction,
      bestPosition.name,
      seasonDay
    );

    playerRow.classList.add(`position-${bestPosition.name.toLowerCase()}`);
    const bestSkillWithExp = bestPosition.ratingWithXp;

    playerRow.appendChild(renderTableCell(bestPosition.name, `${rowClass}td1`));

    playerRow.appendChild(renderTableCell(bestSkillWithExp, `${rowClass}td2`));

    const ratingTd = document.createElement("td");
    ratingTd.classList.add(`${rowClass}td1`);
    ratingTd.appendChild(
      renderComparison(bestSkillWithExp, ratingSettings) // Removed 3rd arg if it was position name, check signature
    );

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
