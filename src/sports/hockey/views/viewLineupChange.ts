import { positionSettings, ratingSettings } from "@/sports/hockey/settings";
import {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
} from "@/base/calculations";
import { renderTableCell, renderComparison } from "@/base/render";

const viewLineupChange = () => {
  const table = document.getElementById("table-1");

  if (!table) {
    return new Error("Table with id 'table-1' not found");
  }

  const tableHeads = table.querySelectorAll("thead");

  const playerRows = table.querySelector("tbody")!.querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr")!.appendChild(renderTableCell("POS", "th1"));
    head.querySelector("tr")!.appendChild(renderTableCell("SK", "th2"));
    head.querySelector("tr")!.appendChild(renderTableCell("RATING", "th1"));
  });

  playerRows.forEach((playerRow, index) => {
    const playerColumns = playerRow.querySelectorAll("td");

    const player = {
      name: playerColumns[2].textContent,
      skills: {
        goalie: parseInt(playerColumns[playerColumns.length - 10].textContent!),
        defence: parseInt(playerColumns[playerColumns.length - 9].textContent!),
        offence: parseInt(playerColumns[playerColumns.length - 8].textContent!),
        shooting: parseInt(
          playerColumns[playerColumns.length - 7].textContent!
        ),
        passing: parseInt(playerColumns[playerColumns.length - 6].textContent!),
        technical: parseInt(
          playerColumns[playerColumns.length - 5].textContent!
        ),
        aggression: parseInt(
          playerColumns[playerColumns.length - 4].textContent!
        ),
      },
      experience: parseInt(
        playerColumns[playerColumns.length - 3].textContent!
      ),
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

    playerRow.appendChild(
      renderTableCell(
        calculateSkillWithExp(bestPosition.level, player.experience),
        `${rowClass}td2`
      )
    );

    const ratingTd = document.createElement("td");
    ratingTd.classList.add(`${rowClass}td1`);
    ratingTd.appendChild(renderComparison(bestSkillWithExp, ratingSettings));

    playerRow.appendChild(ratingTd);
  });
};

export default viewLineupChange;
