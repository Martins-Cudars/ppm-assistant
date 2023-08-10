import { positionSettings, ratingSettings } from "../settings";
import {
  calculatePositionsSkills,
  calculateBestPosition,
  calculateSkillWithExp,
  calculatePositionsQualities,
  calculateBestPotential,
  calculateTrainableSkill,
} from "~/src/calculations.js";
import {
  renderComparison,
  renderPotential,
  renderPotentialBadge,
  renderTrainableSkill,
} from "~/src/render.js";

const viewPlayerProfile = () => {
  const playerTable = document.getElementById("table-1");

  const player = {
    careerLongitivity: parseInt(
      Array.from(playerTable.querySelector("#life_time span").textContent)[0]
    ),
    skills: {
      goalie: parseInt(playerTable.querySelector("#goalie").textContent),
      defence: parseInt(playerTable.querySelector("#defense").textContent),
      midfield: parseInt(playerTable.querySelector("#midfield").textContent),
      offence: parseInt(playerTable.querySelector("#attack").textContent),
      shooting: parseInt(playerTable.querySelector("#shooting").textContent),
      passing: parseInt(playerTable.querySelector("#passing").textContent),
      technical: parseInt(
        playerTable.querySelector("#technique_attribute").textContent
      ),
      speed: parseInt(playerTable.querySelector("#speed").textContent),
      heading: parseInt(playerTable.querySelector("#heading").textContent),
    },
    qualities: {
      goalie: parseInt(playerTable.querySelector("#kva_goalie").textContent),
      defence: parseInt(playerTable.querySelector("#kva_defense").textContent),
      midfield: parseInt(
        playerTable.querySelector("#kva_midfield").textContent
      ),
      offence: parseInt(playerTable.querySelector("#kva_attack").textContent),
      shooting: parseInt(
        playerTable.querySelector("#kva_shooting").textContent
      ),
      passing: parseInt(playerTable.querySelector("#kva_passing").textContent),
      technical: parseInt(
        playerTable.querySelector("#technique_quality").textContent
      ),
      speed: parseInt(playerTable.querySelector("#kva_speed").textContent),
      heading: parseInt(playerTable.querySelector("#kva_heading").textContent),
    },
    experience: parseInt(playerTable.querySelector("#experience").textContent),
    overall: playerTable.querySelector("#index_skill").textContent,
  };

  const positions = calculatePositionsSkills(player, positionSettings);
  const bestPosition = calculateBestPosition(positions);

  const contentColumn = document.querySelector(".column_left");

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
};

export default viewPlayerProfile;
