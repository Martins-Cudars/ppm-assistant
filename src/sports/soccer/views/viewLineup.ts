import { ratingSettings } from "@/sports/soccer/settings";
import { renderTableCell, renderComparison } from "@/base/render";
import {
  SoccerPlayer,
  SoccerPlayerPositionName,
} from "@/sports/soccer/classes/SoccerPlayer";

const viewLineupChange = () => {
  const tables = document.querySelectorAll(".table");

  const players: SoccerPlayer[] = [];

  tables.forEach((table) => {
    const tableHeads = table.querySelectorAll("thead");
    const tableBody = table.querySelector("tbody");
    if (!tableBody) {
      return;
    }
    const playerRows = tableBody.querySelectorAll("tr");

    tableHeads.forEach((head) => {
      const row = head.querySelector("tr");
      if (!row) {
        return;
      }
      row.appendChild(renderTableCell("POS", "th1"));
      row.appendChild(renderTableCell("SK", "th2"));
      row.appendChild(renderTableCell("RATING", "th1"));
    });

    playerRows.forEach((playerRow, index) => {
      const playerColumns = playerRow.querySelectorAll("td");

      if (playerColumns.length > 2) {
        const player = new SoccerPlayer(
          {
            id:
              playerColumns[1]
                .querySelectorAll("a")[1]
                ?.getAttribute("href")
                ?.match(/\d/g)
                ?.join("") || "unknown",
            name: playerColumns[1].textContent || "",
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
            goalie: parseInt(playerColumns[4].textContent || "0"),
            defence: parseInt(playerColumns[5].textContent || "0"),
            midfield: parseInt(playerColumns[6].textContent || "0"),
            offence: parseInt(playerColumns[7].textContent || "0"),
            shooting: parseInt(playerColumns[8].textContent || "0"),
            passing: parseInt(playerColumns[9].textContent || "0"),
            technical: parseInt(playerColumns[10].textContent || "0"),
            speed: parseInt(playerColumns[11].textContent || "0"),
            heading: parseInt(playerColumns[12].textContent || "0"),
          },
          parseInt(playerColumns[13].textContent || "0")
        );
        player.calculatePositions();

        players.push(player);

        const rowClass = index % 2 === 0 ? "tr1" : "tr0";
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

  const formationEl = document.querySelector("#lineup");
  if (!formationEl) {
    return;
  }
  const formationSlots = formationEl.querySelectorAll(".player_slot");

  const findPosition = (
    formationId: string | null
  ): SoccerPlayerPositionName | undefined => {
    if (!formationId) {
      return undefined;
    }

    const formationPositions = {
      GK: [0],
      SD: [11, 12, 21, 22, 16, 17, 26, 27],
      CD: [13, 14, 15, 23, 24, 25],
      CM: [33, 34, 35, 43, 44, 45, 53, 54, 55],
      SM: [31, 32, 41, 42, 51, 52, 36, 37, 46, 47, 56, 57],
      CF: [63, 64, 65, 73, 74, 75],
      SF: [61, 62, 71, 72, 66, 67, 76, 77],
    };

    let position: SoccerPlayerPositionName | undefined;

    for (const [key, value] of Object.entries(formationPositions)) {
      if (value.includes(parseInt(formationId, 10))) {
        position = key as SoccerPlayerPositionName;
      }
    }

    return position;
  };

  const findPlayer = (playerId: string) => {
    return players.find((player) => player.id === playerId);
  };

  const showFormationRankings = () => {
    formationSlots.forEach((slot) => {
      const id = slot.getAttribute("id");

      const player = slot.querySelector(".player");

      if (player) {
        const position = findPosition(id);
        if (!position) {
          return;
        }

        const playerId = player.getAttribute("id")?.substring(12);
        if (!playerId) {
          return;
        }
        const playerData = findPlayer(playerId);
        if (!playerData) {
          return;
        }

        const playerPosition = playerData
          .getPositions()
          .find((skill) => skill.name === position);
        if (!playerPosition) {
          return;
        }

        const captionEl = player.querySelector(
          ".lineup_spot_caption"
        ) as HTMLElement | null;
        if (!captionEl) {
          return;
        }

        const skill = playerPosition.ratingWithXp;

        const existingWrapper = captionEl.querySelector(
          ".lineup_spot_caption_wrapper"
        );
        if (existingWrapper) {
          existingWrapper.remove();
        }

        const captionElWrapper = document.createElement("div");
        captionElWrapper.classList.add("lineup_spot_caption_wrapper");

        captionElWrapper.appendChild(renderComparison(skill, ratingSettings));
        captionEl.appendChild(captionElWrapper);
      }
    });
  };

  showFormationRankings();

  const fieldEl = document.querySelector("#lineup .lineup_field");
  if (!fieldEl) {
    return;
  }

  const config = { attributes: false, childList: true, subtree: true };

  const callback = (
    _mutationList: MutationRecord[],
    observer: MutationObserver
  ) => {
    observer.disconnect();
    showFormationRankings();
    observer.observe(fieldEl, config);
  };

  const observer = new MutationObserver(callback);
  observer.observe(fieldEl, config);
};

export default viewLineupChange;
