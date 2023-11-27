import { positionSettings, ratingSettings } from "@/sports/hockey/settings";
import {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
} from "@/base/calculations";
import { renderTableCell, renderComparison } from "@/base/render";

const viewLineupChange = () => {
  const tables = document.querySelectorAll(".table");

  tables.forEach((table) => {
    const tableHeads = table.querySelectorAll("thead");
    const tableBody = table.querySelector("tbody");

    if (!tableHeads || !tableBody)
      return new Error("Table head / body not found");

    const playerRows = tableBody.querySelectorAll("tr");

    tableHeads.forEach((head) => {
      head.querySelector("tr")!.appendChild(renderTableCell("POS", "th1"));
      head.querySelector("tr")!.appendChild(renderTableCell("SK", "th2"));
      head.querySelector("tr")!.appendChild(renderTableCell("RATING", "th1"));
    });

    playerRows.forEach((playerRow, index) => {
      const playerColumns = playerRow.querySelectorAll("td");

      if (playerColumns.length > 2) {
        const player = {
          name: playerColumns[1].textContent!,
          skills: {
            goalie: parseInt(playerColumns[4].textContent!),
            defence: parseInt(playerColumns[5].textContent!),
            offence: parseInt(playerColumns[6].textContent!),
            shooting: parseInt(playerColumns[7].textContent!),
            passing: parseInt(playerColumns[8].textContent!),
            technical: parseInt(playerColumns[9].textContent!),
            aggression: parseInt(playerColumns[10].textContent!),
          },
          experience: parseInt(playerColumns[11].textContent!),
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
        ratingTd.appendChild(
          renderComparison(bestSkillWithExp, ratingSettings)
        );

        playerRow.appendChild(ratingTd);
      } else {
        playerColumns[1].colSpan = 16;
      }
    });
  });
};

export default viewLineupChange;
