import { ratingSettings, positionSettings } from "@/sports/basketball/settings";
import { calculatePositionsSkills } from "@/sports/basketball/calculations/positionsSkills";
import {
  calculateBestPosition,
  calculateSkillWithExp,
  calculatePositionsQualities,
  calculateBestPotential,
} from "@/base/calculations";
import {
  renderTableCell,
  renderComparison,
  renderPotentialBadge,
} from "@/base/render";

import { BasketballPlayer } from "@/types/Player";

const viewMarket = () => {
  const table = document.getElementById("table-1");
  if (!table) {
    console.error("Table with id 'table-1' not found");
    return;
  }

  const tableHeads = table.querySelectorAll("thead");
  const tableFoots = table.querySelectorAll("tfoot");
  const playerRows = table.querySelector("tbody")?.querySelectorAll("tr");

  tableHeads.forEach((head) => {
    const row = head.querySelector("tr");

    if (row) {
      row.appendChild(renderTableCell("POS", "th1"));
      row.appendChild(renderTableCell("SK", "th2"));
      row.appendChild(renderTableCell("RATING", "th1"));
      row.appendChild(renderTableCell("TRN", "th2"));
    }
  });

  tableFoots.forEach((foot) => {
    const row = foot.querySelector("tr");

    if (row) {
      row.appendChild(renderTableCell("POS", "th1"));
      row.appendChild(renderTableCell("SK", "th2"));
      row.appendChild(renderTableCell("RATING", "th1"));
      row.appendChild(renderTableCell("TRN", "th2"));
    }
  });

  const getSkill = (cell: HTMLTableCellElement) => {
    return parseInt(
      Array.from(cell.childNodes).reduce((a: string, b: ChildNode) => {
        return a + (b.nodeType === 3 ? b.textContent || "" : "");
      }, "")
    );
  };

  playerRows?.forEach((playerRow, index) => {
    const playerColumns = playerRow.querySelectorAll("td");
    const playerQualities = playerRow.querySelectorAll(".kva");

    playerRow.classList.add(`player-row`);

    const player: BasketballPlayer = {
      name: playerColumns[0].querySelectorAll("a")[1].textContent!,
      age: parseInt(playerColumns[1]!.textContent!),
      careerLongitivity: parseInt(
        Array.from(playerColumns[4]!.querySelector("span")!.textContent!)[0]
      ),
      skills: {
        shooting: getSkill(playerColumns[5]),
        blocking: getSkill(playerColumns[6]),
        passing: getSkill(playerColumns[7]),
        technical: getSkill(playerColumns[8]),
        speed: getSkill(playerColumns[9]),
        aggression: getSkill(playerColumns[10]),
        jumping: getSkill(playerColumns[11]),
      },
      qualities: {
        shooting: parseInt(playerQualities[0].textContent!),
        blocking: parseInt(playerQualities[1].textContent!),
        passing: parseInt(playerQualities[2].textContent!),
        technical: parseInt(playerQualities[3].textContent!),
        speed: parseInt(playerQualities[4].textContent!),
        aggression: parseInt(playerQualities[5].textContent!),
        jumping: parseInt(playerQualities[6].textContent!),
      },

      experience: parseInt(playerColumns[12].textContent!),
      overall: parseInt(playerColumns[13].textContent!),
      height: parseInt(playerColumns[14].textContent!),
    };

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const skills = calculatePositionsSkills(player);
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

    const bestPotential = calculateBestPotential(
      calculatePositionsQualities(player, positionSettings)
    );

    const potentialBadge = renderPotentialBadge(
      bestPotential.potential,
      "small"
    );

    const potentialTd = document.createElement("td");
    potentialTd.classList.add(`${rowClass}td2`);
    potentialTd.classList.add("td-center");
    potentialTd.appendChild(potentialBadge);

    playerRow.appendChild(potentialTd);
  });
};

export default viewMarket;
