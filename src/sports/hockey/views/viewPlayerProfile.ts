import { HockeyPlayer, HockeyPlayerInfo } from "@/classes/HockeyPlayer";
import BaseRenderer from "@/classes/BaseRenderer";

import {
  getCurrentSeasonDay,
  recalculatePredictDataAccordingToSeasonDay,
} from "@/utils";

import {
  positionSettings,
  ratingSettings,
  playerGrowthPrediction,
} from "@/sports/hockey/settings";

const viewPlayerProfile = () => {
  const seasonDay = getCurrentSeasonDay();

  const playerTable = document.getElementById("table-1");
  const playerInfo = document.querySelector(".player_info");

  // If player table is not found, return
  if (!playerTable) return new Error("Player table not found");
  if (!playerInfo) return new Error("Player info not found");

  const playerScouted = document
    .querySelector(".player_info")
    ?.querySelector("img[src*='scouted_yes.png']")
    ? true
    : false;
  const skillsVisible = playerTable.querySelector("#goalie") ? true : false; // If goalie stat is found, player data is visible

  const searchParams = new URLSearchParams(window.location.search);
  const dataParam = searchParams.get("data") || "";
  const extractedId = dataParam.split("-")[0];

  const baseInfo: HockeyPlayerInfo = {
    id: extractedId,
    name: playerInfo.querySelector(".link_name")!.textContent!,
    age: parseInt(playerTable.querySelector("#age")!.textContent!),
    careerLongitivity: parseInt(
      Array.from(playerTable.querySelector("#life_time span")!.textContent!)[0]
    ) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    overallRating: parseInt(
      playerTable.querySelector("#index_skill")!.textContent!
    ),
    averageTrainingRatio: parseInt(
      playerTable.querySelector("#prk")!.textContent!
    ),
    preferedSide: "U",
  };

  const skills = skillsVisible
    ? {
        goalie: parseInt(playerTable.querySelector("#goalie")!.textContent!),
        defence: parseInt(playerTable.querySelector("#defense")!.textContent!),
        offence: parseInt(playerTable.querySelector("#attack")!.textContent!),
        shooting: parseInt(
          playerTable.querySelector("#shooting")!.textContent!
        ),
        passing: parseInt(playerTable.querySelector("#passing")!.textContent!),
        technical: parseInt(
          playerTable.querySelector("#technique_attribute")!.textContent!
        ),
        aggression: parseInt(
          playerTable.querySelector("#aggressive")!.textContent!
        ),
      }
    : undefined;

  const experience = skillsVisible
    ? parseInt(playerTable.querySelector("#experience")!.textContent!)
    : undefined;

  const trainingQualities = skillsVisible
    ? {
        goalie: parseInt(
          playerTable.querySelector("#kva_goalie")!.textContent!
        ),
        defence: parseInt(
          playerTable.querySelector("#kva_defense")!.textContent!
        ),
        offence: parseInt(
          playerTable.querySelector("#kva_attack")!.textContent!
        ),
        shooting: parseInt(
          playerTable.querySelector("#kva_shooting")!.textContent!
        ),
        passing: parseInt(
          playerTable.querySelector("#kva_passing")!.textContent!
        ),
        technical: parseInt(
          playerTable.querySelector("#technique_quality")!.textContent!
        ),
        aggression: parseInt(
          playerTable.querySelector("#kva_aggressive")!.textContent!
        ),
      }
    : undefined;

  const player = new HockeyPlayer(
    baseInfo,
    new Date(),
    playerScouted,
    skillsVisible,
    skills,
    experience,
    trainingQualities
  );

  player.calculatePositions();

  console.log(player);

  /** Render */

  const contentColumn = document.querySelector(".column_left")!;

  /**
   * Ability Box
   */

  const positions = player.getPositions();
  const bestPosition = player.getBestPosition();

  console.log("Best position", bestPosition);

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
    positionList += `<div>${position.name} ${position.rating}</div>`;
  });

  allPositions.innerHTML = positionList;

  abilityBox.appendChild(position);

  const abilityDescription = document.createElement("div");
  abilityDescription.classList.add("ability__text");

  const abilityValue = document.createElement("div");
  abilityValue.innerHTML = `<div>${bestPosition.ratingWithXp}</div>
   <div>(${bestPosition.rating})</div>`;

  const comparison = document.createElement("div");
  comparison.classList.add("comparison");
  comparison.appendChild(
    BaseRenderer.renderComparison(bestPosition.ratingWithXp, ratingSettings)
  );

  abilityDescription.appendChild(abilityValue);
  abilityDescription.appendChild(comparison);
  abilityBox.appendChild(abilityDescription);

  contentColumn.appendChild(abilityBox);
};

export default viewPlayerProfile;
