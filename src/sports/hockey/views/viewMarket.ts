import {
  ratingSettings,
} from "@/sports/hockey/settings";
import {
  renderTableCell,
  renderComparison,
  renderPotentialBadge,
  renderRelativeSkill,
} from "@/base/render";
import { getCurrentSeasonDay } from "@/utils/dom";
import {
  HockeyPlayer,
  HockeyPlayerInfo,
} from "@/sports/hockey/classes/HockeyPlayer";

/**
 * View Functions
 */

const viewMarket = () => {
  const table = document.getElementById("table-1");

  if (!table) {
    return new Error("Table with id 'table-1' not found");
  }

  const tableHeads = table.querySelectorAll("thead");
  const tableBody = table.querySelector("tbody");

  const playerRows = tableBody!.querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr")!.appendChild(renderTableCell("Pos", "th1"));
    head.querySelector("tr")!.appendChild(renderTableCell("Sk", "th2"));
    head.querySelector("tr")!.appendChild(renderTableCell("Rating", "th1"));
    head.querySelector("tr")!.appendChild(renderTableCell("Grd", "th2"));
    head.querySelector("tr")!.appendChild(renderTableCell("Rel", "th1"));
  });

  const seasonDay = getCurrentSeasonDay();

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

    const baseInfo: HockeyPlayerInfo = {
      id:
        playerColumns[0]
          ?.querySelectorAll("a")[1]
          ?.getAttribute("href")
          ?.match(/\d+/)?.[0] ?? `market-player-${index}`,
      name: playerColumns[0].textContent ?? "Unknown",
      age: parseInt(playerColumns[1].textContent!),
      careerLongitivity: parseInt(
        Array.from(playerColumns[4].textContent!)[0]
      ) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      overallRating: parseInt(playerColumns[13].textContent!),
      averageTrainingRatio: 0,
      preferredSide: "U",
    };

    const skills = {
        goalie: getSkill(playerColumns[5]),
        defence: getSkill(playerColumns[6]),
        offence: getSkill(playerColumns[7]),
        shooting: getSkill(playerColumns[8]),
        passing: getSkill(playerColumns[9]),
        technical: getSkill(playerColumns[10]),
        aggression: getSkill(playerColumns[11]),
      };
    const trainingQualities = {
        goalie: parseInt(playerQualities[0].textContent!),
        defence: parseInt(playerQualities[1].textContent!),
        offence: parseInt(playerQualities[2].textContent!),
        shooting: parseInt(playerQualities[3].textContent!),
        passing: parseInt(playerQualities[4].textContent!),
        technical: parseInt(playerQualities[5].textContent!),
        aggression: parseInt(playerQualities[6].textContent!),
      };
    const experience = parseInt(playerColumns[12].textContent!);

    const player = new HockeyPlayer(
      baseInfo,
      new Date(),
      "SCOUTED",
      true,
      seasonDay,
      skills,
      experience,
      trainingQualities
    );
    player.calculatePositions();
    player.calculatePositionTrainingQualities();

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const bestPosition = player.getBestPosition();
    const bestPotential = player.getBestPositionTrainingQuality();

    playerRow.appendChild(
      renderTableCell(bestPosition.name, `${rowClass}td1`)
    );

    playerRow.appendChild(renderTableCell(bestPosition.ratingWithXp, `${rowClass}td2`));

    const ratingTd = document.createElement("td");
    ratingTd.classList.add(`${rowClass}td1`);
    ratingTd.appendChild(
      renderComparison(bestPosition.ratingWithXp, ratingSettings, bestPosition.name)
    );

    playerRow.appendChild(ratingTd);

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
      bestPosition.ratingWithXp,
      player.getMaxSkillForAge()
    );
    relativeCell.classList.add(`${rowClass}td2`);
    relativeCell.appendChild(relativeSkill);

    playerRow.appendChild(relativeCell);
  });
};

export default viewMarket;
