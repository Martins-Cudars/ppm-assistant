import { calculatePositionsSkills } from "../calculations/positionsSkills";

const viewPlayerProfile = () => {
  console.log("player profile");
  const playerTable = document.getElementById("table-1");

  if (!playerTable) return new Error("Player table not found");

  const player = {
    age: parseInt(playerTable.querySelector("#age").textContent),
    careerLongitivity: parseInt(
      Array.from(playerTable.querySelector("#life_time span").textContent)[0]
    ),
    height: parseInt(playerTable.querySelector("#vyska").textContent),
    skills: {
      shooting: parseInt(playerTable.querySelector("#shooting").textContent),
      blocking: parseInt(playerTable.querySelector("#block").textContent),
      passing: parseInt(playerTable.querySelector("#passing").textContent),
      technical: parseInt(
        playerTable.querySelector("#technique_attribute").textContent
      ),
      speed: parseInt(playerTable.querySelector("#speed").textContent),

      aggression: parseInt(
        playerTable.querySelector("#aggressivity").textContent
      ),
      jumping: parseInt(playerTable.querySelector("#leaping").textContent),
    },
    qualities: {
      shooting: parseInt(
        playerTable.querySelector("#kva_shooting").textContent
      ),
      blocking: parseInt(playerTable.querySelector("#kva_block").textContent),
      passing: parseInt(playerTable.querySelector("#kva_passing").textContent),
      technical: parseInt(
        playerTable.querySelector("#technique_quality").textContent
      ),
      speed: parseInt(playerTable.querySelector("#kva_speed").textContent),

      aggression: parseInt(
        playerTable.querySelector("#kva_aggressivity").textContent
      ),
      jumping: parseInt(playerTable.querySelector("#kva_leaping").textContent),
    },
    experience: parseInt(playerTable.querySelector("#experience").textContent),
    overall: playerTable.querySelector("#index_skill").textContent,
  };

  console.log(player);

  const positions = calculatePositionsSkills(player);

  console.log(positions);
};

export default viewPlayerProfile;
