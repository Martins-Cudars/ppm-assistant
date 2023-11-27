import { positionSettings, ratingSettings } from "@/sports/soccer/settings";
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

import { SoccerPlayer } from "@/types/Player";

const viewPlayerProfile = () => {
  const table = document.getElementById("table-1");
  const playerInfo = document.querySelector(".player_info");

  if (!table) return new Error("Player table not found");
  if (!playerInfo) return new Error("Player info not found");

  const statsVisible = table.querySelector("#goalie") ? true : false; // If goalie stat is found, player is scouted

  if (!statsVisible)
    return new Error("Player is not scouted or is not on the market");

  const player: SoccerPlayer = {
    name: playerInfo.querySelectorAll("a")[2]!.textContent!,
    age: parseInt(table.querySelector("#age")!.textContent!),
    careerLongitivity: parseInt(
      Array.from(table.querySelector("#life_time span")!.textContent!)[0]
    ),
    skills: {
      goalie: parseInt(table.querySelector("#goalie")!.textContent!),
      defence: parseInt(table.querySelector("#defense")!.textContent!),
      midfield: parseInt(table.querySelector("#midfield")!.textContent!),
      offence: parseInt(table.querySelector("#attack")!.textContent!),
      shooting: parseInt(table.querySelector("#shooting")!.textContent!),
      passing: parseInt(table.querySelector("#passing")!.textContent!),
      technical: parseInt(
        table.querySelector("#technique_attribute")!.textContent!
      ),
      speed: parseInt(table.querySelector("#speed")!.textContent!),
      heading: parseInt(table.querySelector("#heading")!.textContent!),
    },
    qualities: {
      goalie: parseInt(table.querySelector("#kva_goalie")!.textContent!),
      defence: parseInt(table.querySelector("#kva_defense")!.textContent!),
      midfield: parseInt(table.querySelector("#kva_midfield")!.textContent!),
      offence: parseInt(table.querySelector("#kva_attack")!.textContent!),
      shooting: parseInt(table.querySelector("#kva_shooting")!.textContent!),
      passing: parseInt(table.querySelector("#kva_passing")!.textContent!),
      technical: parseInt(
        table.querySelector("#technique_quality")!.textContent!
      ),
      speed: parseInt(table.querySelector("#kva_speed")!.textContent!),
      heading: parseInt(table.querySelector("#kva_heading")!.textContent!),
    },
    experience: parseInt(table.querySelector("#experience")!.textContent!),
    overall: parseInt(table.querySelector("#index_skill")!.textContent!),
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

  const potentialBadge = renderPotentialBadge(bestPotential!.potential);
  potentialBox.appendChild(potentialBadge);

  const potentialDescription = renderPotential(bestPotential!);
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
