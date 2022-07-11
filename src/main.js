import {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
  calculatePositionsQualities,
  calculateBestPotential,
} from "./calculations.js";
import {
  renderTableCell,
  renderComparison,
  renderPotential,
} from "./render.js";

/**
 * View Functions
 */

const viewPlayerList = () => {
  const tableHeads = document
    .getElementById("table-1")
    .querySelectorAll("thead");

  const playerRows = document
    .getElementById("table-1")
    .querySelector("tbody")
    .querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr").appendChild(renderTableCell("POS", "th1"));
    head.querySelector("tr").appendChild(renderTableCell("SK", "th2"));
    head.querySelector("tr").appendChild(renderTableCell("RATING", "th1"));
  });

  playerRows.forEach((playerRow, index) => {
    const playerColumns = playerRow.querySelectorAll("td");

    const player = {
      name: playerColumns[0].textContent,
      age: playerColumns[2].textContent,
      careerLongitivity: Array.from(playerColumns[5].textContent)[0],
      skills: {
        goalie: playerColumns[6].textContent,
        defence: playerColumns[7].textContent,
        offence: playerColumns[8].textContent,
        shooting: playerColumns[9].textContent,
        passing: playerColumns[10].textContent,
        technical: playerColumns[11].textContent,
        aggression: playerColumns[12].textContent,
      },
      experience: parseInt(playerColumns[13].textContent),
      overall: playerColumns[14].textContent,
    };

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const skills = calculatePositionsSkills(player);
    const bestPosition = calculateBestPosition(skills);
    const bestSkillWithExp = calculateSkillWithExp(
      bestPosition.skill,
      player.experience
    );

    playerRow.appendChild(
      renderTableCell(bestPosition.position, `${rowClass}td1`)
    );

    playerRow.appendChild(renderTableCell(bestSkillWithExp, `${rowClass}td2`));

    const ratingTd = document.createElement("td");
    ratingTd.classList.add(`${rowClass}td1`);
    ratingTd.appendChild(renderComparison(bestPosition.skill));

    playerRow.appendChild(ratingTd);
  });
};

const viewPlayerProfile = () => {
  const playerTable = document.getElementById("table-1");

  const player = {
    careerLongitivity: parseInt(
      Array.from(playerTable.querySelector("#life_time span").textContent)[0]
    ),
    skills: {
      goalie: parseInt(playerTable.querySelector("#goalie").textContent),
      defence: parseInt(playerTable.querySelector("#defense").textContent),
      offence: parseInt(playerTable.querySelector("#attack").textContent),
      shooting: parseInt(playerTable.querySelector("#shooting").textContent),
      passing: parseInt(playerTable.querySelector("#passing").textContent),
      technical: parseInt(
        playerTable.querySelector("#technique_attribute").textContent
      ),
      aggression: parseInt(
        playerTable.querySelector("#aggressive").textContent
      ),
    },
    qualities: {
      goalie: parseInt(playerTable.querySelector("#kva_goalie").textContent),
      defence: parseInt(playerTable.querySelector("#kva_defense").textContent),
      offence: parseInt(playerTable.querySelector("#kva_attack").textContent),
      shooting: parseInt(
        playerTable.querySelector("#kva_shooting").textContent
      ),
      passing: parseInt(playerTable.querySelector("#kva_passing").textContent),
      technical: parseInt(
        playerTable.querySelector("#technique_quality").textContent
      ),
      aggression: parseInt(
        playerTable.querySelector("#kva_aggressive").textContent
      ),
    },
    experience: parseInt(playerTable.querySelector("#experience").textContent),
    overall: playerTable.querySelector("#index_skill").textContent,
  };

  const positions = calculatePositionsSkills(player);
  const bestPosition = calculateBestPosition(positions);

  const contentColumn = document.querySelector(".column_left");

  const content = document.createElement("div");
  content.classList.add("player-profile");

  const skill = document.createElement("div");
  skill.classList.add("skill");

  skill.textContent = `${bestPosition.position} ${
    bestPosition.skill
  } (${calculateSkillWithExp(bestPosition.skill, player.experience)})`;

  content.appendChild(skill);

  const comparison = document.createElement("div");
  comparison.classList.add("comparison");
  comparison.appendChild(renderComparison(bestPosition.skill));
  content.appendChild(comparison);

  const bestPotential = calculateBestPotential(
    calculatePositionsQualities(player)
  );
  const potential = renderPotential(bestPotential);
  content.appendChild(potential);

  contentColumn.appendChild(content);
};

const viewLineupChange = () => {
  const tableHeads = document
    .getElementById("table-1")
    .querySelectorAll("thead");

  const playerRows = document
    .getElementById("table-1")
    .querySelector("tbody")
    .querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr").appendChild(renderTableCell("POS", "th1"));
    head.querySelector("tr").appendChild(renderTableCell("SK", "th2"));
  });

  playerRows.forEach((playerRow, index) => {
    const playerColumns = playerRow.querySelectorAll("td");

    const player = {
      name: playerColumns[2].textContent,
      skills: {
        goalie: playerColumns[6].textContent,
        defence: playerColumns[7].textContent,
        offence: playerColumns[8].textContent,
        shooting: playerColumns[9].textContent,
        passing: playerColumns[10].textContent,
        technical: playerColumns[11].textContent,
        aggression: playerColumns[12].textContent,
      },
      experience: parseInt(playerColumns[13].textContent),
      overall: playerColumns[14].textContent,
    };

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const skills = calculatePositionsSkills(player);
    const bestPosition = calculateBestPosition(skills);

    playerRow.appendChild(
      renderTableCell(bestPosition.position, `${rowClass}td1`)
    );

    playerRow.appendChild(
      renderTableCell(
        calculateSkillWithExp(bestPosition.skill, player.experience),
        `${rowClass}td2`
      )
    );
  });
};

/**
 * Run View Functions
 */

if (window.location.href.includes("speletaju-parskats")) viewPlayerList();

if (window.location.href.includes("speletajs")) viewPlayerProfile();

if (window.location.href.includes("rediget-mainu")) viewLineupChange();
