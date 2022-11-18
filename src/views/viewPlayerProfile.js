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

  const positions = calculatePositionsSkills(player);
  const bestPosition = calculateBestPosition(positions);
  const trainableSkill = calculateTrainableSkill(player.skills, bestPosition);

  const contentColumn = document.querySelector(".column_left");

  const content = document.createElement("div");
  content.classList.add("player-profile");

  const potentialBox = document.createElement("div");
  potentialBox.classList.add("player-profile");
  potentialBox.classList.add("player-profile--potential");

  const content2 = document.createElement("div");
  content2.classList.add("player-profile");

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
      calculateSkillWithExp(bestPosition.skill, player.experience)
    )
  );
  content.appendChild(comparison);

  const bestPotential = calculateBestPotential(
    calculatePositionsQualities(player)
  );

  const potentialBadge = renderPotentialBadge(bestPotential.potential);
  potentialBox.appendChild(potentialBadge);

  const potential = renderPotential(bestPotential);
  potentialBox.appendChild(potential);

  const trainableSkillElement = renderTrainableSkill(trainableSkill);
  content2.appendChild(trainableSkillElement);

  contentColumn.appendChild(content);
  contentColumn.appendChild(potentialBox);
  contentColumn.appendChild(content2);
};

export default viewPlayerProfile;
