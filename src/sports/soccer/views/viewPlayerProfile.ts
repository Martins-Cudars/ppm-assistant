import {
  ratingSettings,
  playerGrowthPrediction,
} from "@/sports/soccer/settings";
import { renderPotentialChart } from "@/charts";
import {
  renderComparison,
  renderPotentialBadge,
  renderRelativeSkill,
} from "@/base/render";

import { getCurrentSeasonDay } from "@/utils/dom";
import { SoccerPlayer } from "@/sports/soccer/classes/SoccerPlayer";

const viewPlayerProfile = () => {
  const table = document.getElementById("table-1");
  const playerInfo = document.querySelector(".player_info");

  if (!table) return new Error("Player table not found");
  if (!playerInfo) return new Error("Player info not found");

  const statsVisible = table.querySelector("#goalie") ? true : false; // If goalie stat is found, player is scouted

  if (!statsVisible)
    return new Error("Player is not scouted or is not on the market");

  const seasonDay = getCurrentSeasonDay();
  const searchParams = new URLSearchParams(window.location.search);
  const dataParam = searchParams.get("data") || "";
  const extractedId = dataParam.split("-")[0] || "unknown";

  const trainingQualities = {
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
  };

  const averageTrainingRatio = Math.round(
    Object.values(trainingQualities).reduce((sum, value) => sum + value, 0) /
      Object.values(trainingQualities).length
  );

  const player = new SoccerPlayer(
    {
      id: extractedId,
      name: playerInfo.querySelectorAll("a")[1]!.textContent!,
      age: parseInt(table.querySelector("#age")!.textContent!),
      careerLongitivity: parseInt(
        Array.from(table.querySelector("#life_time span")!.textContent!)[0]
      ) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      overallRating: parseInt(table.querySelector("#index_skill")!.textContent!),
      averageTrainingRatio,
    },
    new Date(),
    true,
    true,
    seasonDay,
    {
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
    parseInt(table.querySelector("#experience")!.textContent!),
    trainingQualities
  );
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

  const bestSkillWithExp = bestPosition.ratingWithXp;

  const abilityValue = document.createElement("div");
  abilityValue.innerHTML = `<div>${bestPosition.ratingWithXp}</div>
  <div>(${bestPosition.baseRating} + ${bestPosition.bonusRating} + ${bestPosition.expBonus})</div>`;

  const comparison = document.createElement("div");
  comparison.classList.add("comparison");
  comparison.appendChild(renderComparison(bestSkillWithExp, ratingSettings));

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
  const bestPotential =
    player.getPositionTrainingQuality(bestPosition.name) ??
    player.getBestPositionTrainingQuality();

  const potentialBadge = renderPotentialBadge(bestPotential.totalTrainingQuality);
  potentialBox.appendChild(potentialBadge);

  const potentialDescription = document.createElement("div");
  potentialDescription.classList.add("potential__text");
  potentialDescription.textContent = `Current position (${bestPotential.position}) training quality is ${bestPotential.totalTrainingQuality} (${bestPotential.baseTrainingQuality} + ${bestPotential.bonusTrainingQuality})`;
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

  /**
   * Relative skill (player ability compared to other players in the same age group)
   */

  const relativeEl = document.createElement("div");
  relativeEl.classList.add("player-profile");
  relativeEl.classList.add("player-profile--relative");

  // Goalies only need 2 skill points per ability compared to other positions which need 2.5 skill points per ability
  const skillRecalculated =
    bestPosition.name === "GK" ? bestSkillWithExp / 1.25 : bestSkillWithExp;

  const relativeSkill = renderRelativeSkill(
    player.age,
    skillRecalculated,
    playerGrowthPrediction
  );

  relativeEl.innerHTML = `<div class="relative__title">Relative skill</div>`;

  relativeEl.appendChild(relativeSkill);
  contentColumn.appendChild(relativeEl);

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
      skill: bestPosition.baseRating,
      position: bestPosition.name,
      exp: player.experience,
    },
    playerGrowthPrediction,
    chartCanvas
  );

  chartBox.appendChild(chartCanvas);

  document.querySelector(".profile_player_center")!.appendChild(chartBox);
};

export default viewPlayerProfile;
