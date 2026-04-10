import { renderTableCell, renderPotentialBadge } from "@/base/render";
import {
  SoccerPlayer,
  SoccerPlayerPositionName,
} from "@/sports/soccer/classes/SoccerPlayer";

const extractSkill = (el: Element) => {
  const skill = el.querySelector("span:first-child");
  return parseInt(skill?.textContent || "0");
};

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
        id: `soccer-training-${index}`,
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
        goalie: extractSkill(playerColumns[5]),
        defence: extractSkill(playerColumns[6]),
        midfield: extractSkill(playerColumns[7]),
        offence: extractSkill(playerColumns[8]),
        shooting: extractSkill(playerColumns[9]),
        passing: extractSkill(playerColumns[10]),
        technical: extractSkill(playerColumns[11]),
        speed: extractSkill(playerColumns[12]),
        heading: extractSkill(playerColumns[13]),
      },
      0,
      {
        goalie: parseInt(playerQualities[0].textContent || "0"),
        defence: parseInt(playerQualities[1].textContent || "0"),
        midfield: parseInt(playerQualities[2].textContent || "0"),
        offence: parseInt(playerQualities[3].textContent || "0"),
        shooting: parseInt(playerQualities[4].textContent || "0"),
        passing: parseInt(playerQualities[5].textContent || "0"),
        technical: parseInt(playerQualities[6].textContent || "0"),
        speed: parseInt(playerQualities[7].textContent || "0"),
        heading: parseInt(playerQualities[8].textContent || "0"),
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
