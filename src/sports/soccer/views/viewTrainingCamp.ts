import { renderTableCell, renderPotentialBadge } from "@/base/render";
import {
  SoccerPlayer,
  SoccerPlayerPositionName,
} from "@/sports/soccer/classes/SoccerPlayer";

const viewTraining = () => {
  const table = document.getElementById("table-1");
  if (!table) return;

  const tableHeads = table.querySelectorAll("thead");
  const tableBody = table.querySelector("tbody");
  if (!tableBody) return;

  const playerRows = tableBody.querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr")?.appendChild(renderTableCell("Grd", "th1"));
  });

  playerRows.forEach((playerRow, index) => {
    const rowClass = index % 2 === 0 ? "tr1" : "tr0";

    const playerQualities = playerRow.querySelectorAll(".kva");
    const playerColumns = playerRow.querySelectorAll("td");

    const player = new SoccerPlayer(
      {
        id: `soccer-training-camp-${index}`,
        name: "Unknown",
        age: 15,
        careerLongitivity: 0,
        overallRating: 0,
        averageTrainingRatio: 0,
      },
      new Date(),
      true,
      true,
      1,
      {
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
      0,
      {
        goalie: parseInt(playerQualities[0].textContent!),
        defence: parseInt(playerQualities[1].textContent!),
        midfield: parseInt(playerQualities[2].textContent!),
        offence: parseInt(playerQualities[3].textContent!),
        shooting: parseInt(playerQualities[4].textContent!),
        passing: parseInt(playerQualities[5].textContent!),
        technical: parseInt(playerQualities[6].textContent!),
        speed: parseInt(playerQualities[7].textContent!),
        heading: parseInt(playerQualities[8].textContent!),
      }
    );
    player.calculatePositions();
    player.calculatePositionTrainingQualities();

    const bestPosition = player.getBestPosition();
    const bestPotential =
      player.getPositionTrainingQuality(
        bestPosition.name as SoccerPlayerPositionName
      ) ??
      player.getBestPositionTrainingQuality();

    const potentialBadge = renderPotentialBadge(
      bestPotential.totalTrainingQuality,
      "small"
    );
    const potentialTd = document.createElement("td");
    potentialTd.classList.add(`${rowClass}td1`);
    potentialTd.classList.add("td-center");
    potentialTd.appendChild(potentialBadge);

    playerRow.appendChild(potentialTd);
  });
};

export default viewTraining;
