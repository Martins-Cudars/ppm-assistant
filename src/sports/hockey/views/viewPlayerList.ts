import { positionSettings, ratingSettings } from "@/sports/hockey/settings";
import {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
} from "@/base/calculations";
import { renderTableCell, renderComparison, renderButton } from "@/base/render";

const viewPlayerList = () => {
  const mainContent = document.getElementsByClassName("main_content");
  const table = document.getElementById("table-1");

  if (!table) {
    return new Error("Table with id 'table-1' not found");
  }

  const tableHeads = table.querySelectorAll("thead");
  const tableBody = table.querySelector("tbody");

  const playerRows = tableBody!.querySelectorAll("tr");

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
      age: playerColumns[2].textContent,
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
