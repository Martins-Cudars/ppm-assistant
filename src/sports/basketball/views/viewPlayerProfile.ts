import { ratingSettings } from "@/sports/basketball/settings";
import {
  renderComparison,
  renderPotentialBadge,
} from "@/base/render";
import { parseBasketballPlayerFromProfilePage } from "@/sports/basketball/parsers/playerProfile";

const viewPlayerProfile = () => {
  const playerTable = document.getElementById("table-1");
  const playerInfo = document.querySelector(".player_info");

  if (!playerTable) return new Error("Player table not found");
  if (!playerInfo) return new Error("Player info not found");

  const player = parseBasketballPlayerFromProfilePage(playerTable, playerInfo);
  player.calculatePositions();
  player.calculatePositionTrainingQualities();
  const positions = player.getPositions();
  const bestPosition = player.getBestPosition();

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
  position.textContent = bestPosition.name;

  const allPositions = document.createElement("div");
  allPositions.classList.add("ability__positions");

  let positionList = ``;

  positions.forEach((position) => {
    positionList += `<div>${position.name} ${position.ratingWithXp}</div>`;
  });

  allPositions.innerHTML = positionList;

  abilityBox.appendChild(position);

  const abilityDescription = document.createElement("div");
  abilityDescription.classList.add("ability__text");

  const abilityValue = document.createElement("div");
  abilityValue.innerHTML = `<div>${bestPosition.ratingWithXp}</div>
   <div>(${bestPosition.ratingWithBonus})</div>`;

  const comparison = document.createElement("div");
  comparison.classList.add("comparison");
  comparison.appendChild(
    renderComparison(bestPosition.ratingWithXp, ratingSettings)
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

  const potentials = player.getPositionTrainingQualities();
  const bestPotential = player.getCurrentPositionTrainingQuality();
  const potentialBadge = renderPotentialBadge(bestPotential.totalTrainingQuality);
  potentialBox.appendChild(potentialBadge);

  const potentialDescription = document.createElement("div");
  potentialDescription.classList.add("potential__text");
  potentialDescription.textContent = `Current position (${bestPosition.name}) training quality is ${bestPotential.totalTrainingQuality}`;
  potentialBox.appendChild(potentialDescription);

  const allPotentials = document.createElement("div");
  allPotentials.classList.add("potential__positions");

  let potentialList = ``;

  potentials.forEach((potential) => {
    potentialList += `<div>${potential.position} ${potential.totalTrainingQuality}</div>`;
  });

  allPotentials.innerHTML = potentialList;
  potentialBox.appendChild(allPotentials);

  contentColumn.appendChild(potentialBox);
};

export default viewPlayerProfile;
