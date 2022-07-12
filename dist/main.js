const $f4e261e811334a0a$export$28a5266254550ff3 = [
    {
        name: "Goalie",
        ratios: {
            goalie: 1,
            technical: 0.5,
            passing: 0.5
        }
    },
    {
        name: "Defence",
        ratios: {
            defence: 1,
            passing: 0.5,
            aggression: 0.5
        }
    },
    {
        name: "Winger",
        ratios: {
            offence: 1,
            technical: 0.5,
            aggression: 0.5
        }
    },
    {
        name: "Center",
        ratios: {
            offence: 1,
            technical: 0.5,
            passing: 0.5
        }
    }, 
];
const $f4e261e811334a0a$export$593f2d24ede2dfb0 = {
    low: 500,
    medium: 1000,
    high: 1500
};


const $78fc06ffa0ef6332$export$f424e510a287eb0 = (player)=>{
    const positionSkills = [];
    (0, $f4e261e811334a0a$export$28a5266254550ff3).forEach((position)=>{
        const skills = [];
        for (const [key, value] of Object.entries(position.ratios))skills.push(parseInt(player.skills[key]) / value);
        positionSkills.push({
            position: position.name,
            level: Math.min(...skills)
        });
    });
    return positionSkills;
};
const $78fc06ffa0ef6332$export$fefc44fbabdf230f = (skills)=>{
    let bestPosition = {
        position: "Unknown",
        skill: 0
    };
    skills.forEach((skill)=>{
        if (skill.level > bestPosition.skill) {
            bestPosition.position = skill.position;
            bestPosition.skill = skill.level;
        }
    });
    return bestPosition;
};
const $78fc06ffa0ef6332$export$5898f23eb7acb0be = (skill, experience)=>{
    return Math.round(skill * (1 + experience / 500));
};
const $78fc06ffa0ef6332$export$bf339f9dce5a47df = (player)=>{
    const positionPotentials = [];
    (0, $f4e261e811334a0a$export$28a5266254550ff3).forEach((position)=>{
        let qualities = 0;
        let modifier = 0;
        for (const [key, value] of Object.entries(position.ratios)){
            qualities += player.qualities[key] * value;
            modifier += value;
        }
        positionPotentials.push({
            position: position.name,
            potential: Math.min(qualities / modifier)
        });
    });
    return positionPotentials;
};
const $78fc06ffa0ef6332$export$82338cb6413791b1 = (potentials)=>{
    let bestPotential = {
        position: "Unknown",
        potential: 0
    };
    potentials.forEach((potential)=>{
        if (potential.potential > bestPotential.potential) {
            bestPotential.position = potential.position;
            bestPotential.potential = potential.potential;
        }
    });
    return bestPotential;
};



const $18c53b0039ffc5db$export$b36ad6a61166502b = (content, cssClass)=>{
    const cell = document.createElement("td");
    cell.classList.add(cssClass);
    cell.textContent = content;
    return cell;
};
const $18c53b0039ffc5db$export$83fab2b954b58590 = (skill)=>{
    const ratingPercentage = Math.min(skill / (0, $f4e261e811334a0a$export$593f2d24ede2dfb0).low * 100, 100);
    const ratingOuter = document.createElement("div");
    const ratingInner = document.createElement("div");
    ratingOuter.classList.add("rating");
    ratingInner.classList.add("rating__inner");
    ratingInner.setAttribute("style", `width: ${ratingPercentage}%`);
    ratingOuter.setAttribute("alt", `${ratingPercentage}%`);
    ratingOuter.appendChild(ratingInner);
    return ratingOuter;
};
const $18c53b0039ffc5db$export$c1975daa4eb91b44 = (bestPotential)=>{
    const potential = document.createElement("div");
    potential.classList.add("potential");
    potential.textContent = `Best potential position is ${bestPotential.position} with ${Math.round(bestPotential.potential)}`;
    return potential;
};


const $72f8ded643bf6cd3$var$viewPlayerList = ()=>{
    const tableHeads = document.getElementById("table-1").querySelectorAll("thead");
    const playerRows = document.getElementById("table-1").querySelector("tbody").querySelectorAll("tr");
    tableHeads.forEach((head)=>{
        head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("POS", "th1"));
        head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("SK", "th2"));
        head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("RATING", "th1"));
    });
    playerRows.forEach((playerRow, index)=>{
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
                aggression: playerColumns[12].textContent
            },
            experience: parseInt(playerColumns[13].textContent),
            overall: playerColumns[14].textContent
        };
        const rowClass = index % 2 === 0 ? "tr1" : "tr0";
        const skills = (0, $78fc06ffa0ef6332$export$f424e510a287eb0)(player);
        const bestPosition = (0, $78fc06ffa0ef6332$export$fefc44fbabdf230f)(skills);
        const bestSkillWithExp = (0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.skill, player.experience);
        playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)(bestPosition.position, `${rowClass}td1`));
        playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)(bestSkillWithExp, `${rowClass}td2`));
        const ratingTd = document.createElement("td");
        ratingTd.classList.add(`${rowClass}td1`);
        ratingTd.appendChild((0, $18c53b0039ffc5db$export$83fab2b954b58590)(bestSkillWithExp));
        playerRow.appendChild(ratingTd);
    });
};
var $72f8ded643bf6cd3$export$2e2bcd8739ae039 = $72f8ded643bf6cd3$var$viewPlayerList;




const $8c58922ff46d23a2$var$viewPlayerProfile = ()=>{
    const playerTable = document.getElementById("table-1");
    const player = {
        careerLongitivity: parseInt(Array.from(playerTable.querySelector("#life_time span").textContent)[0]),
        skills: {
            goalie: parseInt(playerTable.querySelector("#goalie").textContent),
            defence: parseInt(playerTable.querySelector("#defense").textContent),
            offence: parseInt(playerTable.querySelector("#attack").textContent),
            shooting: parseInt(playerTable.querySelector("#shooting").textContent),
            passing: parseInt(playerTable.querySelector("#passing").textContent),
            technical: parseInt(playerTable.querySelector("#technique_attribute").textContent),
            aggression: parseInt(playerTable.querySelector("#aggressive").textContent)
        },
        qualities: {
            goalie: parseInt(playerTable.querySelector("#kva_goalie").textContent),
            defence: parseInt(playerTable.querySelector("#kva_defense").textContent),
            offence: parseInt(playerTable.querySelector("#kva_attack").textContent),
            shooting: parseInt(playerTable.querySelector("#kva_shooting").textContent),
            passing: parseInt(playerTable.querySelector("#kva_passing").textContent),
            technical: parseInt(playerTable.querySelector("#technique_quality").textContent),
            aggression: parseInt(playerTable.querySelector("#kva_aggressive").textContent)
        },
        experience: parseInt(playerTable.querySelector("#experience").textContent),
        overall: playerTable.querySelector("#index_skill").textContent
    };
    const positions = (0, $78fc06ffa0ef6332$export$f424e510a287eb0)(player);
    const bestPosition = (0, $78fc06ffa0ef6332$export$fefc44fbabdf230f)(positions);
    const contentColumn = document.querySelector(".column_left");
    const content = document.createElement("div");
    content.classList.add("player-profile");
    const skill = document.createElement("div");
    skill.classList.add("skill");
    skill.textContent = `${bestPosition.position} ${bestPosition.skill} (${(0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.skill, player.experience)})`;
    content.appendChild(skill);
    const comparison = document.createElement("div");
    comparison.classList.add("comparison");
    comparison.appendChild((0, $18c53b0039ffc5db$export$83fab2b954b58590)((0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.skill, player.experience)));
    content.appendChild(comparison);
    const bestPotential = (0, $78fc06ffa0ef6332$export$82338cb6413791b1)((0, $78fc06ffa0ef6332$export$bf339f9dce5a47df)(player));
    const potential = (0, $18c53b0039ffc5db$export$c1975daa4eb91b44)(bestPotential);
    content.appendChild(potential);
    contentColumn.appendChild(content);
};
var $8c58922ff46d23a2$export$2e2bcd8739ae039 = $8c58922ff46d23a2$var$viewPlayerProfile;




const $1367a000d1b1e933$var$viewLineupChange = ()=>{
    const tables = document.querySelectorAll(".table");
    tables.forEach((table)=>{
        const tableHeads = table.querySelectorAll("thead");
        const playerRows = table.querySelector("tbody").querySelectorAll("tr");
        tableHeads.forEach((head)=>{
            head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("POS", "th1"));
            head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("SK", "th2"));
            head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("RATING", "th1"));
        });
        playerRows.forEach((playerRow, index)=>{
            const playerColumns = playerRow.querySelectorAll("td");
            const player = {
                name: playerColumns[1].textContent,
                skills: {
                    goalie: playerColumns[4].textContent,
                    defence: playerColumns[5].textContent,
                    offence: playerColumns[6].textContent,
                    shooting: playerColumns[7].textContent,
                    passing: playerColumns[8].textContent,
                    technical: playerColumns[9].textContent,
                    aggression: playerColumns[10].textContent
                },
                experience: parseInt(playerColumns[11].textContent)
            };
            const rowClass = index % 2 === 0 ? "tr1" : "tr0";
            const skills = (0, $78fc06ffa0ef6332$export$f424e510a287eb0)(player);
            const bestPosition = (0, $78fc06ffa0ef6332$export$fefc44fbabdf230f)(skills);
            const bestSkillWithExp = (0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.skill, player.experience);
            playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)(bestPosition.position, `${rowClass}td1`));
            playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)((0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.skill, player.experience), `${rowClass}td2`));
            const ratingTd = document.createElement("td");
            ratingTd.classList.add(`${rowClass}td1`);
            ratingTd.appendChild((0, $18c53b0039ffc5db$export$83fab2b954b58590)(bestSkillWithExp));
            playerRow.appendChild(ratingTd);
        });
    });
};
var $1367a000d1b1e933$export$2e2bcd8739ae039 = $1367a000d1b1e933$var$viewLineupChange;




const $eb760bba466069f0$var$viewLineupChange = ()=>{
    const tableHeads = document.getElementById("table-1").querySelectorAll("thead");
    const playerRows = document.getElementById("table-1").querySelector("tbody").querySelectorAll("tr");
    tableHeads.forEach((head)=>{
        head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("POS", "th1"));
        head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("SK", "th2"));
        head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("RATING", "th1"));
    });
    playerRows.forEach((playerRow, index)=>{
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
                aggression: playerColumns[12].textContent
            },
            experience: parseInt(playerColumns[13].textContent),
            overall: playerColumns[14].textContent
        };
        const rowClass = index % 2 === 0 ? "tr1" : "tr0";
        const skills = (0, $78fc06ffa0ef6332$export$f424e510a287eb0)(player);
        const bestPosition = (0, $78fc06ffa0ef6332$export$fefc44fbabdf230f)(skills);
        const bestSkillWithExp = (0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.skill, player.experience);
        playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)(bestPosition.position, `${rowClass}td1`));
        playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)((0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.skill, player.experience), `${rowClass}td2`));
        const ratingTd = document.createElement("td");
        ratingTd.classList.add(`${rowClass}td1`);
        ratingTd.appendChild((0, $18c53b0039ffc5db$export$83fab2b954b58590)(bestSkillWithExp));
        playerRow.appendChild(ratingTd);
    });
};
var $eb760bba466069f0$export$2e2bcd8739ae039 = $eb760bba466069f0$var$viewLineupChange;




/**
 * View Functions
 */ const $732c1c75caf626a8$var$viewMarket = ()=>{
    const tableHeads = document.getElementById("table-1").querySelectorAll("thead");
    const playerRows = document.getElementById("table-1").querySelector("tbody").querySelectorAll("tr");
    tableHeads.forEach((head)=>{
        head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("POS", "th1"));
        head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("SK", "th2"));
        head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("RATING", "th1"));
    });
    const getSkill = (column)=>{
        return parseInt([].reduce.call(column.childNodes, (a, b)=>{
            return a + (b.nodeType === 3 ? b.textContent : "");
        }, ""));
    };
    playerRows.forEach((playerRow, index)=>{
        const playerColumns = playerRow.querySelectorAll("td");
        const player = {
            name: playerColumns[0].textContent,
            age: playerColumns[1].textContent,
            careerLongitivity: Array.from(playerColumns[4].textContent)[0],
            skills: {
                goalie: getSkill(playerColumns[5]),
                defence: getSkill(playerColumns[6]),
                offence: getSkill(playerColumns[7]),
                shooting: getSkill(playerColumns[8]),
                passing: getSkill(playerColumns[9]),
                technical: getSkill(playerColumns[10]),
                aggression: getSkill(playerColumns[11])
            },
            experience: parseInt(playerColumns[12].textContent),
            overall: playerColumns[13].textContent
        };
        const rowClass = index % 2 === 0 ? "tr1" : "tr0";
        const skills = (0, $78fc06ffa0ef6332$export$f424e510a287eb0)(player);
        const bestPosition = (0, $78fc06ffa0ef6332$export$fefc44fbabdf230f)(skills);
        const bestSkillWithExp = (0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.skill, player.experience);
        playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)(bestPosition.position, `${rowClass}td1`));
        playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)(bestSkillWithExp, `${rowClass}td2`));
        const ratingTd = document.createElement("td");
        ratingTd.classList.add(`${rowClass}td1`);
        ratingTd.appendChild((0, $18c53b0039ffc5db$export$83fab2b954b58590)(bestSkillWithExp));
        playerRow.appendChild(ratingTd);
    });
};
var $732c1c75caf626a8$export$2e2bcd8739ae039 = $732c1c75caf626a8$var$viewMarket;


/**
 * Run View Functions
 */ if (window.location.href.includes("speletaju-parskats")) (0, $72f8ded643bf6cd3$export$2e2bcd8739ae039)();
if (window.location.href.includes("speletajs")) (0, $8c58922ff46d23a2$export$2e2bcd8739ae039)();
if (window.location.href.includes("mainas")) (0, $1367a000d1b1e933$export$2e2bcd8739ae039)();
if (window.location.href.includes("rediget-mainu")) (0, $eb760bba466069f0$export$2e2bcd8739ae039)();
if (window.location.href.includes("/lv/tirgus")) (0, $732c1c75caf626a8$export$2e2bcd8739ae039)();


//# sourceMappingURL=main.js.map
