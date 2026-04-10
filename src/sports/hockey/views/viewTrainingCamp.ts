import { renderTableCell, renderPotentialBadge } from "@/base/render";
import { HockeyPlayer } from "@/sports/hockey/classes/HockeyPlayer";
import { getCurrentSeasonDay } from "@/utils/dom";

const extractSkill = (el: Element): number => {
  const qualityElStart = el.innerHTML.indexOf('<span class="kva">');
  return parseInt(el.innerHTML.slice(0, qualityElStart).replace(/^\D+/g, ""));
};

const viewTraining = () => {
  const table = document.getElementById("table-1");
  if (!table) return;

  const tableHeads = table.querySelectorAll("thead");
  const tableBody = table.querySelector("tbody");
  if (!tableBody) return;

  const playerRows = tableBody.querySelectorAll("tr");
  const seasonDay = getCurrentSeasonDay();

  tableHeads.forEach((head) => {
    head.querySelector("tr")?.appendChild(renderTableCell("Grd", "th1"));
  });

  playerRows.forEach((playerRow, index) => {
    const rowClass = index % 2 === 0 ? "tr1" : "tr0";

    const playerQualities = playerRow.querySelectorAll(".kva");
    const playerColumns = playerRow.querySelectorAll("td");

    const player = {
      skills: {
        goalie: extractSkill(playerColumns[6]),
        defence: extractSkill(playerColumns[7]),
        offence: extractSkill(playerColumns[8]),
        shooting: extractSkill(playerColumns[9]),
        passing: extractSkill(playerColumns[10]),
        technical: extractSkill(playerColumns[11]),
        aggression: extractSkill(playerColumns[12]),
      },
      qualities: {
        goalie: parseInt(playerQualities[0].textContent || "0"),
        defence: parseInt(playerQualities[1].textContent || "0"),
        offence: parseInt(playerQualities[2].textContent || "0"),
        shooting: parseInt(playerQualities[3].textContent || "0"),
        passing: parseInt(playerQualities[4].textContent || "0"),
        technical: parseInt(playerQualities[5].textContent || "0"),
        aggression: parseInt(playerQualities[6].textContent || "0"),
      },
    };

    const hockeyPlayer = new HockeyPlayer(
      {
        id: `training-camp-${index}`,
        name: "Training Camp Player",
        age: 0,
        careerLongitivity: 3,
        overallRating: 0,
        averageTrainingRatio: 0,
        preferredSide: "U",
      },
      new Date(),
      "UNSCOUTED",
      true,
      seasonDay,
      player.skills,
      undefined,
      player.qualities,
      0
    );
    hockeyPlayer.calculatePositions();
    hockeyPlayer.calculatePositionTrainingQualities();
    const bestPotential = hockeyPlayer.getBestPositionTrainingQuality();

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
