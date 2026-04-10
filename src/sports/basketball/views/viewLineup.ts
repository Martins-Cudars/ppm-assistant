import { ratingSettings } from "@/sports/basketball/settings";
import { BasketballPlayerPosition } from "@/sports/basketball/classes/BasketballPlayer";
import { parseBasketballPlayerFromLineupRow } from "@/sports/basketball/parsers/playerRows";
import { renderTableCell, renderComparison } from "@/base/render";

type BasketballLineupPlayer = {
  id: string;
  positions: BasketballPlayerPosition[];
  experience: number;
};

const viewLineup = () => {
  const players: BasketballLineupPlayer[] = [];

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
    playerRow.classList.add(`player-row`);
    const parsed = parseBasketballPlayerFromLineupRow(playerRow);
    parsed.player.calculatePositions();
    players.push({
      id: parsed.id,
      positions: parsed.player.positions,
      experience: parsed.player.experience,
    });

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const bestPosition = parsed.player.getBestPosition();

    playerRow.classList.add(`position-${bestPosition.name.toLowerCase()}`);

    playerRow.appendChild(
      renderTableCell(bestPosition.name, `${rowClass}td1`)
    );

    playerRow.appendChild(renderTableCell(bestPosition.ratingWithXp, `${rowClass}td2`));

    const ratingTd = document.createElement("td");
    ratingTd.classList.add(`${rowClass}td1`);
    ratingTd.appendChild(renderComparison(bestPosition.ratingWithXp, ratingSettings));
    playerRow.appendChild(ratingTd);
  });

  const formationPositions = ["PG", "SG", "C", "SF", "PF"] as const;

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
      if (!playerData) return;

      const captionEl = slot.querySelector(".lineup_spot_caption");

      if (!captionEl) return;
      // create a wrapper for the caption element to add padding

      const captionElWrapper = document.createElement("span");
      captionElWrapper.classList.add(
        "lineup_spot_caption_wrapper",
        "lineup_spot_caption_wrapper--basketball"
      );

      const positionSkill = playerData.positions.find((skill) => skill.name === position);
      if (!positionSkill) return;

      const existingWrapper = captionEl.querySelector(".lineup_spot_caption_wrapper");
      existingWrapper?.remove();

      captionElWrapper.appendChild(
        renderComparison(positionSkill.ratingWithXp, ratingSettings)
      );
      captionEl.appendChild(captionElWrapper);
    });
  };

  showFormationRankings();

  const fieldEl = document.querySelector("#lineup .lineup_field");

  const config = { attributes: false, childList: true, subtree: true };

  if (!fieldEl) return;

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

export default viewLineup;
