import { positionSettings, ratingSettings } from "../settings";
import { calculatePositionsSkills } from "../calculations/positionsSkills";

import {
  calculateBestPosition,
  calculateSkillWithExp,
  calculatePositionsQualities,
  calculateBestPotential,
} from "~/src/calculations.js";

import {
  renderComparison,
  renderPotential,
  renderPotentialBadge,
} from "~/src/render.js";

const viewPlayerProfile = () => {
  console.log("player profile");
  const playerTable = document.getElementById("table-1");

  if (!playerTable) return new Error("Player table not found");

  const player = {
    age: parseInt(playerTable.querySelector("#age")!.textContent!),
    careerLongitivity: parseInt(
      Array.from(playerTable.querySelector("#life_time span")!.textContent!)[0]
    ),
    height: parseInt(playerTable.querySelector("#vyska")!.textContent!),
    skills: {
      shooting: parseInt(playerTable.querySelector("#shooting")!.textContent!),
      blocking: parseInt(playerTable.querySelector("#block")!.textContent!),
      passing: parseInt(playerTable.querySelector("#passing")!.textContent!),
      technical: parseInt(
        playerTable.querySelector("#technique_attribute")!.textContent!
      ),
      speed: parseInt(playerTable.querySelector("#speed")!.textContent!),

      aggression: parseInt(
        playerTable.querySelector("#aggressivity")!.textContent!
      ),
      jumping: parseInt(playerTable.querySelector("#leaping")!.textContent!),
    },
    qualities: {
      shooting: parseInt(
        playerTable.querySelector("#kva_shooting")!.textContent!
      ),
      blocking: parseInt(playerTable.querySelector("#kva_block")!.textContent!),
      passing: parseInt(
        playerTable.querySelector("#kva_passing")!.textContent!
      ),
      technical: parseInt(
        playerTable.querySelector("#technique_quality")!.textContent!
      ),
      speed: parseInt(playerTable.querySelector("#kva_speed")!.textContent!),

      aggression: parseInt(
        playerTable.querySelector("#kva_aggressivity")!.textContent!
      ),
      jumping: parseInt(
        playerTable.querySelector("#kva_leaping")!.textContent!
      ),
    },
    experience: parseInt(
      playerTable.querySelector("#experience")!.textContent!
    ),
    overall: playerTable.querySelector("#index_skill")!.textContent!,
  };

  console.log(player);

  const positions = calculatePositionsSkills(player);
  const bestPosition = calculateBestPosition(positions);

  console.log(positions);

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
};

export default viewPlayerProfile;
