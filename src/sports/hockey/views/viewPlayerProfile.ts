import { positionSettings, ratingSettings } from "@/sports/hockey/settings";
import { renderPotentialChart } from "@/charts";

import {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
  calculatePositionsQualities,
} from "@/base/calculations";
import {
  renderComparison,
  renderPotential,
  renderPotentialBadge,
} from "@/base/render";

const viewPlayerProfile = () => {
  const playerTable = document.getElementById("table-1");

  // If player table is not found, return
  if (!playerTable) return new Error("Player table not found");

  const player = {
    age: parseInt(playerTable.querySelector("#age").textContent),
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

  const positions = calculatePositionsSkills(player, positionSettings);
  const bestPosition = calculateBestPosition(positions);

  const contentColumn = document.querySelector(".column_left");

  // If content column is not found, return
  if (!contentColumn) return new Error("Content column not found");
  /**
   * Ability Box
   */
  const abilityBox = document.createElement("div");
  abilityBox.classList.add("player-profile");
  abilityBox.classList.add("player-profile--ability");

  const position = document.createElement("div");
  position.classList.add("ability__position");
  position.textContent = bestPosition.position;

  const allPositions = document.createElement("div");
  allPositions.classList.add("ability__positions");

  let positionList = ``;

  positions.forEach((position) => {
    positionList += `<div>${position.position} ${calculateSkillWithExp(
      position.level,
      player.experience
    )}</div>`;
  });

  allPositions.innerHTML = positionList;

  abilityBox.appendChild(position);

  const abilityDescription = document.createElement("div");
  abilityDescription.classList.add("ability__text");

  const abilityValue = document.createElement("div");
  abilityValue.innerHTML = `<div>${calculateSkillWithExp(
    bestPosition.level,
    player.experience
  )}</div>
   <div>(${bestPosition.level})</div>`;

  const comparison = document.createElement("div");
  comparison.classList.add("comparison");
  comparison.appendChild(
    renderComparison(
      calculateSkillWithExp(bestPosition.level, player.experience),
      ratingSettings
    )
  );

  abilityDescription.appendChild(abilityValue);
  abilityDescription.appendChild(comparison);
  abilityBox.appendChild(abilityDescription);

  abilityBox.appendChild(allPositions);

  contentColumn.appendChild(abilityBox);

  /**
   * Potential Box
   */
  const potentialBox = document.createElement("div");
  potentialBox.classList.add("player-profile");
  potentialBox.classList.add("player-profile--potential");

  const potentials = calculatePositionsQualities(player, positionSettings);
  const bestPotential = potentials.find(
    (el) => el.position === bestPosition.position
  );

  const potentialBadge = renderPotentialBadge(bestPotential.potential);
  potentialBox.appendChild(potentialBadge);

  const potentialDescription = renderPotential(bestPotential);
  potentialBox.appendChild(potentialDescription);

  const allPotentials = document.createElement("div");
  allPotentials.classList.add("potential__positions");

  let potentialList = ``;

  potentials.forEach((potential) => {
    potentialList += `<div>${potential.position} ${potential.potential}</div>`;
  });

  allPotentials.innerHTML = potentialList;
  potentialBox.appendChild(allPotentials);

  contentColumn.appendChild(potentialBox);

  /**
   * Add chart
   */

  const chartBox = document.createElement("div");
  const chartCanvas = document.createElement("canvas");

  chartBox.classList.add("player-chart");
  chartCanvas.classList.add("player-chart__canvas");

  renderPotentialChart(
    {
      age: player.age,
      skill: bestPosition.level,
      position: bestPosition.position,
      exp: player.experience,
    },
    chartCanvas
  );

  chartBox.appendChild(chartCanvas);

  document.querySelector(".profile_player_center").appendChild(chartBox);
};

export default viewPlayerProfile;
