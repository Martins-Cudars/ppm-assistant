import {
  ratingSettings,
} from "@/sports/soccer/settings";
import {
  renderTableCell,
  renderComparison,
  renderPotentialBadge,
  renderRelativeSkill,
} from "@/base/render";
import { SoccerPlayer } from "@/sports/soccer/classes/SoccerPlayer";

/**
 * View Functions
 */

const viewMarket = () => {
  const table = document.getElementById("table-1");

  if (!table) throw new Error("Table not found");

  const tableHeads = table.querySelectorAll("thead");

  const playerRows = table.querySelector("tbody")!.querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr")!.appendChild(renderTableCell("Pos", "th1"));
    head.querySelector("tr")!.appendChild(renderTableCell("Sk", "th2"));
    head.querySelector("tr")!.appendChild(renderTableCell("Rating", "th1"));
    head.querySelector("tr")!.appendChild(renderTableCell("Grd", "th2"));
    head.querySelector("tr")!.appendChild(renderTableCell("Rel", "th1"));
  });

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

    const player = new SoccerPlayer(
      {
        id: `soccer-market-${index}`,
        name: playerColumns[0].textContent || "",
        age: parseInt(playerColumns[1].textContent!),
        careerLongitivity: parseInt(
          Array.from(playerColumns[3].textContent!)[0]
        ) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        overallRating: parseInt(playerColumns[14].textContent!),
        averageTrainingRatio: 0,
      },
      new Date(),
      true,
      true,
      1,
      {
        goalie: getSkill(playerColumns[4]),
        defence: getSkill(playerColumns[5]),
        midfield: getSkill(playerColumns[6]),
        offence: getSkill(playerColumns[7]),
        shooting: getSkill(playerColumns[8]),
        passing: getSkill(playerColumns[9]),
        technical: getSkill(playerColumns[10]),
        speed: getSkill(playerColumns[11]),
        heading: getSkill(playerColumns[12]),
      },
      parseInt(playerColumns[13].textContent!),
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

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const bestPosition = player.getBestPosition();
    const bestSkillWithExp = bestPosition.ratingWithXp;

    playerRow.appendChild(
      renderTableCell(bestPosition.name, `${rowClass}td1`)
    );

    playerRow.appendChild(renderTableCell(bestSkillWithExp, `${rowClass}td2`));

    const ratingTd = document.createElement("td");
    ratingTd.classList.add(`${rowClass}td1`);
    ratingTd.appendChild(renderComparison(bestSkillWithExp, ratingSettings));

    playerRow.appendChild(ratingTd);

    const bestPotential = player.getBestPositionTrainingQuality();

    const potentialBadge = renderPotentialBadge(
      bestPotential.totalTrainingQuality,
      "small"
    );

    const potentialTd = document.createElement("td");
    potentialTd.classList.add(`${rowClass}td2`);
    potentialTd.classList.add("td-center");
    potentialTd.appendChild(potentialBadge);

    playerRow.appendChild(potentialTd);

    const relativeCell = document.createElement("td");

    const relativeSkill = renderRelativeSkill(
      player.age,
      bestSkillWithExp,
      player.getMaxSkillForAge(bestPosition.name)
    );
    relativeCell.classList.add(`${rowClass}td2`);
    relativeCell.appendChild(relativeSkill);

    playerRow.appendChild(relativeCell);
  });
};

export default viewMarket;
