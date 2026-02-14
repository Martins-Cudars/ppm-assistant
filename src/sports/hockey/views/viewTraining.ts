import { positionSettings } from "@/sports/hockey/settings";

import {
  calculatePositionsQualities,
  calculatePositionsSkills,
  calculateBestPosition,
} from "@/base/calculations";

import { renderTableCell, renderPotentialBadge } from "@/base/render";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { getCurrentSeasonDay } from "@/utils";
import { collectBatchPlayerData } from "@/services/dataCollector";

const extractSkill = (el) => {
  const qualityElStart = el.innerHTML.indexOf('<span class="kva">');
  return parseInt(el.innerHTML.slice(0, qualityElStart).replace(/^\D+/g, ""));
};

const viewTraining = () => {
  const tableHeads = document
    .getElementById("table-1")
    .querySelectorAll("thead");

  const playerRows = document
    .getElementById("table-1")
    .querySelector("tbody")
    .querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr").appendChild(renderTableCell("Grd", "th1"));
  });

  const players: HockeyPlayer[] = [];
  const seasonDay = getCurrentSeasonDay();

  playerRows.forEach((playerRow, index) => {
    const rowClass = index % 2 === 0 ? "tr1" : "tr0";

    const playerQualities = playerRow.querySelectorAll(".kva");
    const playerColumns = playerRow.querySelectorAll("td");

    // Extract player identifying information
    const nameLink = playerColumns[0].querySelector("a.link_name") as HTMLAnchorElement;
    const id = nameLink?.href.split("data=")[1]?.split("-")[0] || "unknown";
    const name = nameLink?.textContent?.trim() || "Unknown";
    const age = parseInt(playerColumns[3].textContent || "0");

    const player = {
      skills: {
        goalie: extractSkill(playerColumns[5]),
        defence: extractSkill(playerColumns[6]),
        offence: extractSkill(playerColumns[7]),
        shooting: extractSkill(playerColumns[8]),
        passing: extractSkill(playerColumns[9]),
        technical: extractSkill(playerColumns[10]),
        aggression: extractSkill(playerColumns[11]),
      },
      qualities: {
        goalie: parseInt(playerQualities[0].textContent),
        defence: parseInt(playerQualities[1].textContent),
        offence: parseInt(playerQualities[2].textContent),
        shooting: parseInt(playerQualities[3].textContent),
        passing: parseInt(playerQualities[4].textContent),
        technical: parseInt(playerQualities[5].textContent),
        aggression: parseInt(playerQualities[6].textContent),
      },
    };

    const playerPositions = calculatePositionsSkills(player, positionSettings);
    const bestPosition = calculateBestPosition(playerPositions);
    const potentials = calculatePositionsQualities(player, positionSettings);

    const bestPotential = potentials.find(
      (el) => el.position === bestPosition.position
    );

    const potentialBadge = renderPotentialBadge(
      bestPotential.potential,
      "small"
    );
    const potentialTd = document.createElement("td");
    potentialTd.classList.add(`${rowClass}td1`);
    potentialTd.classList.add("td-center");
    potentialTd.appendChild(potentialBadge);

    playerRow.appendChild(potentialTd);

    // Create HockeyPlayer instance for caching (skills + training qualities)
    if (id !== "unknown") {
      const hockeyPlayer = new HockeyPlayer(
        {
          id: id,
          name: name,
          age: age,
          careerLongitivity: 3, // Default - unknown from training view
          overallRating: 0, // Unknown from training view
          averageTrainingRatio: 0, // Unknown from training view
          preferredSide: "U", // Unknown from training view
        },
        new Date(),
        "UNSCOUTED", // Unknown from training view
        true, // Mark as visible since we have skill data
        seasonDay,
        player.skills,
        undefined, // No experience data in training view
        player.qualities,
        0 // No injury data in training view
      );
      players.push(hockeyPlayer);
    }
  });

  // Collect and cache player data from training view
  if (players.length > 0) {
    collectBatchPlayerData(players, "PlayerTraining");
  }
};

export default viewTraining;
