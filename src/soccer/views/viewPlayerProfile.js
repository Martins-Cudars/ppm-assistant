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
  console.log("soccer - view player profile");

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
    // qualities: {
    //   goalie: parseInt(playerTable.querySelector("#kva_goalie").textContent),
    //   defence: parseInt(playerTable.querySelector("#kva_defense").textContent),
    //   offence: parseInt(playerTable.querySelector("#kva_attack").textContent),
    //   shooting: parseInt(
    //     playerTable.querySelector("#kva_shooting").textContent
    //   ),
    //   passing: parseInt(playerTable.querySelector("#kva_passing").textContent),
    //   technical: parseInt(
    //     playerTable.querySelector("#technique_quality").textContent
    //   ),
    //   aggression: parseInt(
    //     playerTable.querySelector("#kva_aggressive").textContent
    //   ),
    // },
    experience: parseInt(playerTable.querySelector("#experience").textContent),
    overall: playerTable.querySelector("#index_skill").textContent,
  };

  const positions = calculatePositionsSkills(player, positionSettings);
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
  comparison.appendChild(
    renderComparison(
      calculateSkillWithExp(bestPosition.skill, player.experience),
      ratingSettings
    )
  );
  content.appendChild(comparison);

  contentColumn.appendChild(content);
};

export default viewPlayerProfile;
