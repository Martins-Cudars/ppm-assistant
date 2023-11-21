import { positionSettings, ratingSettings } from "@/sports/basketball/settings";
import { calculatePositionsSkills } from "@/sports/basketball/calculations/positionsSkills";

import {
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

  const positions = calculatePositionsSkills(player);
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
};

export default viewPlayerProfile;
