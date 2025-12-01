import { ratingSettings } from "@/sports/hockey/settings";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
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
        const rowClass = index % 2 === 0 ? "tr1" : "tr0";

        const player = new HockeyPlayer(
          {
            id: "unknown",
            name: playerColumns[1].textContent!,
            age: 0, // Not available in lineup
            careerLongitivity: 0, // Not available
            overallRating: 0, // Not available
            averageTrainingRatio: 0,
            preferredSide: "U",
          },
          new Date(),
          false,
          true,
          {
            goalie: parseInt(playerColumns[4].textContent!),
            defence: parseInt(playerColumns[5].textContent!),
            offence: parseInt(playerColumns[6].textContent!),
            shooting: parseInt(playerColumns[7].textContent!),
            passing: parseInt(playerColumns[8].textContent!),
            technical: parseInt(playerColumns[9].textContent!),
            aggression: parseInt(playerColumns[10].textContent!),
          },
          parseInt(playerColumns[11].textContent!)
        );

        player.calculatePositions();
        const bestPosition = player.getBestPosition();
        const bestSkillWithExp = bestPosition.ratingWithXp;

        playerRow.appendChild(
          renderTableCell(bestPosition.name, `${rowClass}td1`)
        );

        playerRow.appendChild(
          renderTableCell(bestSkillWithExp, `${rowClass}td2`)
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
