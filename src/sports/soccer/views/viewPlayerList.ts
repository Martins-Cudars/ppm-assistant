import {
  ratingSettings,
} from "@/sports/soccer/settings";
import {
  renderTableCell,
  renderComparison,
  renderButton,
  renderRelativeSkill,
} from "@/base/render";
import { SoccerPlayer } from "@/sports/soccer/classes/SoccerPlayer";

const viewPlayerList = () => {
  const mainContent = document.getElementsByClassName("main_content");

  const table = document.getElementById("table-1");

  if (!table) {
    return new Error("Table with id 'table-1' not found");
  }

  const tableHead = table.querySelector("thead")!;
  const tableFoot = table.querySelector("tfoot")!;

  const playerRows = table.querySelector("tbody")!.querySelectorAll("tr");

  tableHead.querySelector("tr")!.appendChild(renderTableCell("POS", "th1"));
  tableHead.querySelector("tr")!.appendChild(renderTableCell("SK", "th2"));
  tableHead.querySelector("tr")!.appendChild(renderTableCell("RATING", "th1"));
  tableHead.querySelector("tr")!.appendChild(renderTableCell("Rel", "th2"));

  tableFoot.querySelector("tr")!.appendChild(renderTableCell("POS", "th1"));
  tableFoot.querySelector("tr")!.appendChild(renderTableCell("SK", "th2"));
  tableFoot.querySelector("tr")!.appendChild(renderTableCell("RATING", "th1"));
  tableFoot.querySelector("tr")!.appendChild(renderTableCell("Rel", "th2"));

  playerRows.forEach((playerRow, index) => {
    const playerColumns = playerRow.querySelectorAll("td");
    playerRow.classList.add(`player-row`);

    const player = new SoccerPlayer(
      {
        id: `soccer-list-${index}`,
        name: playerColumns[0].textContent!,
        age: parseInt(playerColumns[2].textContent!),
        careerLongitivity: parseInt(
          Array.from(playerColumns[5].textContent!)[0]
        ) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        overallRating: parseInt(playerColumns[16].textContent!),
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
      parseInt(playerColumns[15].textContent!)
    );
    player.calculatePositions();

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const bestPosition = player.getBestPosition();
    playerRow.classList.add(`position-${bestPosition.name.toLowerCase()}`);

    const bestSkillWithExp = bestPosition.ratingWithXp;

    playerRow.classList.add(`pos-${bestPosition.name.toLowerCase()}`);

    playerRow.appendChild(
      renderTableCell(bestPosition.name, `${rowClass}td1`)
    );

    playerRow.appendChild(renderTableCell(bestSkillWithExp, `${rowClass}td2`));

    const ratingTd = document.createElement("td");
    ratingTd.classList.add(`${rowClass}td1`);
    ratingTd.appendChild(renderComparison(bestSkillWithExp, ratingSettings));

    playerRow.appendChild(ratingTd);

    const relativeCell = document.createElement("td");

    const relativeSkill = renderRelativeSkill(
      player.age,
      bestSkillWithExp,
        player.getMaxSkillForAge()
    );
    relativeCell.classList.add(`${rowClass}td2`);
    relativeCell.appendChild(relativeSkill);

    playerRow.appendChild(relativeCell);
  });

  const filterByPositions = (pos: string) => {
    if (pos === "All") {
      document.querySelectorAll(".player-row").forEach((row) => {
        (row as HTMLElement).style.display = "table-row";
      });
      return;
    }

    document.querySelectorAll(".player-row").forEach((row) => {
      (row as HTMLElement).style.display = "none";
    });

    document
      .querySelectorAll(`.position-${pos.toLowerCase()}`)
      .forEach((row) => {
        (row as HTMLElement).style.display = "table-row";
      });
  };

  const positionFilter = document.createElement("div");
  positionFilter.classList.add("position-filter");
  positionFilter.classList.add("white_box");

  const positionButtonAll = renderButton(`All (${playerRows.length})`);
  positionButtonAll.addEventListener("click", () => filterByPositions("All"));
  positionFilter.append(positionButtonAll);

  ["GK", "SD", "CD", "SM", "CM", "SF", "CF"].forEach((pos) => {
    const positionButton = renderButton(
      `${pos} (${
        document.querySelectorAll(`.position-${pos.toLowerCase()}`).length
      })`
    );
    positionButton.addEventListener("click", () => filterByPositions(pos));
    positionFilter.append(positionButton);
  });

  mainContent[0].prepend(positionFilter);
};

export default viewPlayerList;
