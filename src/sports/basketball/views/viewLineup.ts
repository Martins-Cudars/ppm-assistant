import { positionSettings, ratingSettings } from "@/sports/basketball/settings";
import {
  calculateBestPosition,
  calculateSkillWithExp,
} from "@/base/calculations";
import { calculatePositionsSkills } from "@/sports/basketball/calculations/positionsSkills";
import { renderTableCell, renderComparison } from "@/base/render";

const viewLineup = () => {
  const players = [];

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
    }
  });

  tableFoots.forEach((foot) => {
    const row = foot.querySelector("tr");

    if (row) {
      row.appendChild(renderTableCell("POS", "th1"));
      row.appendChild(renderTableCell("SK", "th2"));
      row.appendChild(renderTableCell("RATING", "th1"));
    }
  });

  playerRows?.forEach((playerRow, index) => {
    const playerColumns = playerRow.querySelectorAll("td");
    playerRow.classList.add(`player-row`);

    const player = {
      id:
        playerColumns[1]
          .querySelectorAll("a")[1]
          ?.getAttribute("href")
          ?.match(/\d/g)
          ?.join("") || "",
      name: playerColumns[1].textContent,
      age: playerColumns[3].textContent,
      careerLongitivity: null,
      skills: {
        shooting: parseInt(playerColumns[4].textContent!),
        blocking: parseInt(playerColumns[5].textContent!),
        passing: parseInt(playerColumns[6].textContent!),
        technical: parseInt(playerColumns[7].textContent!),
        speed: parseInt(playerColumns[8].textContent!),
        aggression: parseInt(playerColumns[9].textContent!),
        jumping: parseInt(playerColumns[10].textContent!),
      },

      experience: parseInt(playerColumns[11].textContent!),
      overall: parseInt(playerColumns[12].textContent!),
      height: parseInt(playerColumns[13].textContent!),
    };

    players.push(player);

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
  });

  const formationPositions = ["PG", "SG", "C", "SF", "PF"];

  const findPlayer = (playerId: string) => {
    return players.find((player) => player.id === playerId);
  };

  const extractPlayerId = (lineupString: string) => {
    const match = lineupString.match(/lineup_spot_(\d+)/);
    return match![1];
  };

  const showFormationRankings = () => {
    const formationEl = document.querySelector("#lineup");

    if (!formationEl) return;
    const formationSlots = formationEl.querySelectorAll(".player");

    formationSlots.forEach((slot, index) => {
      const position = formationPositions[index];
      const playerId = slot.getAttribute("id");
      if (!playerId) return;

      const id = extractPlayerId(playerId);
      if (!id) return;

      const playerData = findPlayer(id);

      const playerSkills = calculatePositionsSkills(playerData);

      const captionEl = slot.querySelector(".lineup_spot_caption");

      if (!captionEl) return;
      // create a wrapper for the caption element to add padding

      const captionElWrapper = document.createElement("span");
      captionElWrapper.classList.add(
        "lineup_spot_caption_wrapper",
        "lineup_spot_caption_wrapper--basketball"
      );

      const skill = calculateSkillWithExp(
        playerSkills.find((skill) => skill.position === position).level,
        playerData.experience
      );

      if (captionEl.querySelector(".lineup_spot_caption_wrapper"))
        captionEl.querySelector(".lineup_spot_caption_wrapper").remove();

      captionElWrapper.appendChild(renderComparison(skill, ratingSettings));
      captionEl.appendChild(captionElWrapper);
    });
  };

  showFormationRankings();

  const fieldEl = document.querySelector("#lineup .lineup_field");

  const config = { attributes: false, childList: true, subtree: true };

  const callback = (mutationList, observer) => {
    observer.disconnect();
    showFormationRankings();
    observer.observe(fieldEl, config);
  };

  const observer = new MutationObserver(callback);
  observer.observe(fieldEl, config);
};

export default viewLineup;
