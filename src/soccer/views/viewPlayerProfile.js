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

  const skillBox = document.createElement("div");
  skillBox.classList.add("player-profile");

  const skill = document.createElement("div");
  skill.classList.add("skill");

  skill.textContent = `${bestPosition.position} ${
    bestPosition.skill
  } (${calculateSkillWithExp(bestPosition.skill, player.experience)})`;

  skillBox.appendChild(skill);

  const comparison = document.createElement("div");
  comparison.classList.add("comparison");
  comparison.appendChild(
    renderComparison(
      calculateSkillWithExp(bestPosition.skill, player.experience),
      ratingSettings
    )
  );
  skillBox.appendChild(comparison);
  contentColumn.appendChild(skillBox);

  const potentialBox = document.createElement("div");
  potentialBox.classList.add("player-profile");
  potentialBox.classList.add("player-profile--potential");

  const bestPotential = calculateBestPotential(
    calculatePositionsQualities(player, positionSettings)
  );

  const potentialBadge = renderPotentialBadge(bestPotential.potential);
  potentialBox.appendChild(potentialBadge);

  const potential = renderPotential(bestPotential);
  potentialBox.appendChild(potential);

  contentColumn.appendChild(potentialBox);
};

export default viewPlayerProfile;
