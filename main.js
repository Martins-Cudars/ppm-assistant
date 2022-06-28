console.log("main.js loaded");
/**
 * Settings
 */

const positionSettings = [
  {
    name: "Goalie",
    ratios: {
      goalie: 1,
      technical: 0.5,
      passing: 0.5,
    },
  },
  {
    name: "Defence",
    ratios: {
      defence: 1,
      passing: 0.5,
      aggression: 0.5,
    },
  },
  {
    name: "Winger",
    ratios: {
      offence: 1,
      technical: 0.5,
      aggression: 0.5,
    },
  },
  {
    name: "Center",
    ratios: {
      offence: 1,
      technical: 0.5,
      passing: 0.5,
    },
  },
];

/**
 * Calculate Functions
 */

calculateSkillWithExp = (skill, experience) => {
  return Math.round(skill * (1 + experience / 500));
};

const calculatePositionsSkills = (player) => {
  const positionSkills = [];
  positionSettings.forEach((position) => {
    const skills = [];

    for (const [key, value] of Object.entries(position.ratios)) {
      skills.push(parseInt(player.skills[key]) / value);
    }

    positionSkills.push({
      position: position.name,
      level: Math.min(...skills),
    });
  });

  return positionSkills;
};

calculateBestPosition = (skills) => {
  let bestPosition = {
    position: "Unknown",
    skill: 0,
  };

  skills.forEach((skill) => {
    if (skill.level > bestPosition.skill) {
      bestPosition.position = skill.position;
      bestPosition.skill = skill.level;
    }
  });
  return bestPosition;
};

/**
 * Render Functions
 */

const renderTableCell = (content, cssClass) => {
  const cell = document.createElement("td");
  cell.classList.add(cssClass);
  cell.textContent = content;
  return cell;
};

/**
 * View Functions
 */

const viewPlayerList = () => {
  const tableHeads = document
    .getElementById("table-1")
    .querySelectorAll("thead");

  const playerRows = document
    .getElementById("table-1")
    .querySelector("tbody")
    .querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr").appendChild(renderTableCell("POS", "th1"));
    head.querySelector("tr").appendChild(renderTableCell("SK", "th2"));
  });

  playerRows.forEach((playerRow, index) => {
    const playerColumns = playerRow.querySelectorAll("td");

    const player = {
      name: playerColumns[0].textContent,
      age: playerColumns[2].textContent,
      careerLongitivity: Array.from(playerColumns[5].textContent)[0],
      skills: {
        goalie: playerColumns[6].textContent,
        defence: playerColumns[7].textContent,
        offence: playerColumns[8].textContent,
        shooting: playerColumns[9].textContent,
        passing: playerColumns[10].textContent,
        technical: playerColumns[11].textContent,
        aggression: playerColumns[12].textContent,
      },
      experience: parseInt(playerColumns[13].textContent),
      overall: playerColumns[14].textContent,
    };

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const skills = calculatePositionsSkills(player);
    const bestPosition = calculateBestPosition(skills);

    playerRow.appendChild(
      renderTableCell(bestPosition.position, `${rowClass}td1`)
    );

    playerRow.appendChild(
      renderTableCell(
        calculateSkillWithExp(bestPosition.skill, player.experience),
        `${rowClass}td2`
      )
    );
  });
};

const viewPlayerProfile = () => {
  const playerTable = document.getElementById("table-1");

  const player = {
    careerLongitivity: Array.from(
      playerTable.querySelector("#life_time").textContent
    )[0],
    skills: {
      goalie: playerTable.querySelector("#goalie").textContent,
      defence: playerTable.querySelector("#defense").textContent,
      offence: playerTable.querySelector("#attack").textContent,
      shooting: playerTable.querySelector("#shooting").textContent,
      passing: playerTable.querySelector("#passing").textContent,
      technical: playerTable.querySelector("#technique_attribute").textContent,
      aggression: playerTable.querySelector("#aggressive").textContent,
    },
    experience: parseInt(playerTable.querySelector("#experience").textContent),
    overall: playerTable.querySelector("#index_skill").textContent,
  };

  const positions = calculatePositionsSkills(player);
  const bestPosition = calculateBestPosition(positions);

  console.log(positions);
  console.log(bestPosition);

  const contentColumn = document.querySelector(".column_left");

  const content = document.createElement("div");
  content.textContent = `${bestPosition.position} ${
    bestPosition.skill
  } (${calculateSkillWithExp(bestPosition.skill, player.experience)})`;
  contentColumn.appendChild(content);
};

const viewLineupChange = () => {
  const tableHeads = document
    .getElementById("table-1")
    .querySelectorAll("thead");

  const playerRows = document
    .getElementById("table-1")
    .querySelector("tbody")
    .querySelectorAll("tr");

  tableHeads.forEach((head) => {
    head.querySelector("tr").appendChild(renderTableCell("POS", "th1"));
    head.querySelector("tr").appendChild(renderTableCell("SK", "th2"));
  });

  playerRows.forEach((playerRow, index) => {
    const playerColumns = playerRow.querySelectorAll("td");

    const player = {
      name: playerColumns[2].textContent,
      skills: {
        goalie: playerColumns[6].textContent,
        defence: playerColumns[7].textContent,
        offence: playerColumns[8].textContent,
        shooting: playerColumns[9].textContent,
        passing: playerColumns[10].textContent,
        technical: playerColumns[11].textContent,
        aggression: playerColumns[12].textContent,
      },
      experience: parseInt(playerColumns[13].textContent),
      overall: playerColumns[14].textContent,
    };

    const rowClass = index % 2 === 0 ? "tr1" : "tr0";
    const skills = calculatePositionsSkills(player);
    const bestPosition = calculateBestPosition(skills);

    playerRow.appendChild(
      renderTableCell(bestPosition.position, `${rowClass}td1`)
    );

    playerRow.appendChild(
      renderTableCell(
        calculateSkillWithExp(bestPosition.skill, player.experience),
        `${rowClass}td2`
      )
    );
  });
};

/**
 * Run View Functions
 */

if (window.location.href.includes("speletaju-parskats")) viewPlayerList();

if (window.location.href.includes("speletajs")) viewPlayerProfile();

if (window.location.href.includes("rediget-mainu")) viewLineupChange();
