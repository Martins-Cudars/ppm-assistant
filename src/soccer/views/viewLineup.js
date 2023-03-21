import { positionSettings, ratingSettings } from "../settings";
import {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
} from "~/src/calculations.js";
import { renderTableCell, renderComparison } from "~/src/render.js";

const viewLineupChange = () => {
  const tables = document.querySelectorAll(".table");

  const players = []

  tables.forEach((table) => {
    const tableHeads = table.querySelectorAll("thead");
    const playerRows = table.querySelector("tbody").querySelectorAll("tr");

    tableHeads.forEach((head) => {
      head.querySelector("tr").appendChild(renderTableCell("POS", "th1"));
      head.querySelector("tr").appendChild(renderTableCell("SK", "th2"));
      head.querySelector("tr").appendChild(renderTableCell("RATING", "th1"));
    });

    playerRows.forEach((playerRow, index) => {
      const playerColumns = playerRow.querySelectorAll("td");

      if (playerColumns.length > 2) {
        const player = {
          id: playerColumns[1].querySelectorAll("a")[1].getAttribute("href").match(/\d/g).join(""),
          name: playerColumns[1].textContent,
          skills: {
            goalie: playerColumns[4].textContent,
            defence: playerColumns[5].textContent,
            midfield: playerColumns[6].textContent,
            offence: playerColumns[7].textContent,
            shooting: playerColumns[8].textContent,
            passing: playerColumns[9].textContent,
            technical: playerColumns[10].textContent,
            speed: playerColumns[11].textContent,
            heading: playerColumns[12].textContent,
          },
          experience: parseInt(playerColumns[13].textContent),
        };

        players.push(player)

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

  const formationEl = document.querySelector("#lineup");
  const formationSlots = formationEl.querySelectorAll(".player_slot");

  const findPosition = (formationId) => {
    const formationPositions = {
      GK: [0],
      SD: [11, 12, 21, 22, 16, 17, 26, 27],
      CD: [13, 14, 15, 23, 24, 25],
      CM: [33, 34, 35, 43, 44, 45, 53, 54, 55],
      SM: [31, 32, 41, 42, 51, 52, 36, 37, 46, 47, 56, 57],
      CF: [63, 64, 65, 73, 74, 75],
      SF: [61, 62, 71, 72, 66, 67, 76, 77],
    }

    let position

    for (const [key, value] of Object.entries(formationPositions)) {
      if (value.includes(parseInt(formationId))) {
        position = key
      }
    }

    return position
  }

  const findPlayer = (playerId) => {
    return players.find(player => player.id === playerId)

  }


  const showFormationRankings = () => {
    formationSlots.forEach((slot) => {
      const id = slot.getAttribute("id");


      const player = slot.querySelector(".player");

      if (player) {
        const position = findPosition(id)
        const playerId = player.getAttribute("id").substring(12)
        const playerData = findPlayer(playerId)

        const playerSkills = calculatePositionsSkills(playerData, positionSettings);

        const captionEl = player.querySelector(".lineup_spot_caption");
        const skill = calculateSkillWithExp(playerSkills.find(skill => skill.position === position).level, playerData.experience)

        if (captionEl.querySelector(".rating")) {
          captionEl.querySelector(".rating").remove()
        }

        captionEl.appendChild(renderComparison(skill, ratingSettings))
        
      }
      
    })
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

export default viewLineupChange;
