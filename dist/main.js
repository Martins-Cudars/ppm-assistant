const $05be6c1d1617fb2b$export$28a5266254550ff3 = [
    {
        name: "G",
        ratios: {
            goalie: 1,
            technical: 0.5,
            passing: 0.5
        }
    },
    {
        name: "D",
        ratios: {
            defence: 1,
            passing: 0.5,
            aggression: 0.5
        },
        bonus: {
            technical: 0.5
        }
    },
    {
        name: "W",
        ratios: {
            offence: 1,
            technical: 0.5,
            aggression: 0.5
        },
        bonus: {
            shooting: 0.75
        }
    },
    {
        name: "C",
        ratios: {
            offence: 1,
            technical: 0.5,
            passing: 0.5
        },
        bonus: {
            shooting: 0.5
        }
    }, 
];
const $05be6c1d1617fb2b$export$593f2d24ede2dfb0 = {
    low: 500,
    medium: 1000,
    high: 1500
};


const $78fc06ffa0ef6332$export$f424e510a287eb0 = (player, positionSettings)=>{
    const positionSkills = [];
    positionSettings.forEach((position)=>{
        const skills = [];
        for (const [key, value] of Object.entries(position.ratios))skills.push(parseInt(player.skills[key]) / value);
        positionSkills.push({
            position: position.name,
            level: Math.round(Math.min(...skills))
        });
    });
    return positionSkills;
};
const $78fc06ffa0ef6332$export$fefc44fbabdf230f = (skills)=>{
    return skills.sort((a, b)=>b.level - a.level)[0];
};
const $78fc06ffa0ef6332$export$5898f23eb7acb0be = (skill, experience)=>{
    return Math.round(skill * (1 + experience / 500));
};
const $78fc06ffa0ef6332$export$bf339f9dce5a47df = (player, positionSettings)=>{
    const positionPotentials = [];
    positionSettings.forEach((position)=>{
        let qualities = 0;
        let modifier = 0;
        for (const [key, value] of Object.entries(position.ratios)){
            qualities += player.qualities[key] * value;
            modifier += value;
        }
        if (position.bonus) for (const [key1, value1] of Object.entries(position.bonus)){
            qualities += player.qualities[key1] * value1;
            modifier += value1;
        }
        positionPotentials.push({
            position: position.name,
            potential: Math.round(Math.min(qualities / modifier))
        });
    });
    return positionPotentials;
};
const $78fc06ffa0ef6332$export$82338cb6413791b1 = (potentials)=>{
    return potentials.sort((a, b)=>b.potential - a.potential)[0];
};


const $7a499cf51e07ffbe$export$a15314779c685f5c = (potential)=>{
    if (!potential || potential === null) return {
        label: "?",
        class: "unknown"
    };
    if (potential >= 95) return {
        label: "A+",
        class: "a-plus"
    };
    if (potential >= 90) return {
        label: "A",
        class: "a"
    };
    if (potential >= 85) return {
        label: "B+",
        class: "b-plus"
    };
    if (potential >= 80) return {
        label: "B",
        class: "b"
    };
    if (potential >= 75) return {
        label: "C+",
        class: "c-plus"
    };
    if (potential >= 70) return {
        label: "C",
        class: "c"
    };
    if (potential >= 60) return {
        label: "D+",
        class: "d-plus"
    };
    if (potential >= 50) return {
        label: "D",
        class: "d"
    };
    if (potential < 50) return {
        label: "F",
        class: "f"
    };
};


const $18c53b0039ffc5db$export$b36ad6a61166502b = (content, cssClass)=>{
    const cell = document.createElement("td");
    cell.classList.add(cssClass);
    cell.textContent = content;
    return cell;
};
const $18c53b0039ffc5db$export$83fab2b954b58590 = (skill, ratingSettings)=>{
    let ratingPercentage;
    const ratingOuter = document.createElement("div");
    const ratingInner = document.createElement("div");
    ratingOuter.classList.add("rating");
    ratingInner.classList.add("rating__inner");
    if (skill < ratingSettings.low) {
        ratingOuter.style.backgroundImage = `url(${chrome.runtime.getURL("icons/star-empty.svg")})`;
        ratingInner.style.backgroundImage = `url(${chrome.runtime.getURL("icons/star-silver.svg")})`;
        ratingPercentage = Math.min(skill / ratingSettings.low * 100, 100);
    } else if (skill < ratingSettings.medium) {
        ratingOuter.style.backgroundImage = `url(${chrome.runtime.getURL("icons/star-silver.svg")})`;
        ratingInner.style.backgroundImage = `url(${chrome.runtime.getURL("icons/star-gold.svg")})`;
        ratingPercentage = Math.min((skill - ratingSettings.low) / (ratingSettings.medium - ratingSettings.low) * 100, 100);
    } else if (skill >= ratingSettings.medium) {
        ratingOuter.style.backgroundImage = `url(${chrome.runtime.getURL("icons/star-gold.svg")})`;
        ratingInner.style.backgroundImage = `url(${chrome.runtime.getURL("icons/star-diamond.svg")})`;
        ratingPercentage = Math.min((skill - ratingSettings.medium) / (ratingSettings.high - ratingSettings.medium) * 100, 100);
    }
    ratingInner.style.width = `${ratingPercentage}%`;
    ratingOuter.appendChild(ratingInner);
    return ratingOuter;
};
const $18c53b0039ffc5db$export$c1975daa4eb91b44 = (bestPotential)=>{
    const potential = document.createElement("div");
    potential.classList.add("potential__text");
    potential.textContent = `Best potential position is ${bestPotential.position} with ${Math.round(bestPotential.potential)}`;
    return potential;
};
const $18c53b0039ffc5db$export$1e190777fe7d790a = (potential, size)=>{
    const badge = document.createElement("div");
    badge.classList.add("potential__badge");
    if (size) badge.classList.add(`potential__badge--${size}`);
    const potentialObj = (0, $7a499cf51e07ffbe$export$a15314779c685f5c)(potential);
    badge.classList.add(`potential__badge--${potentialObj.class}`);
    badge.textContent = potentialObj.label;
    return badge;
};
const $18c53b0039ffc5db$export$4fd609a04677ca67 = (trainableSkill)=>{
    const trainableSkillElement = document.createElement("div");
    trainableSkillElement.classList.add("trainable-skill");
    trainableSkillElement.textContent = `Trainable skill is ${trainableSkill.minimumSkill.skill} with ${trainableSkill.minimumSkill.ability}, needs to improve by ${trainableSkill.difference}`;
    return trainableSkillElement;
};


const $4cd00c11b313a3a7$var$viewPlayerList = ()=>{
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
        const skills = (0, $78fc06ffa0ef6332$export$f424e510a287eb0)(player, (0, $05be6c1d1617fb2b$export$28a5266254550ff3));
        const bestPosition = (0, $78fc06ffa0ef6332$export$fefc44fbabdf230f)(skills);
        const bestSkillWithExp = (0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.level, player.experience);
        playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)(bestPosition.position, `${rowClass}td1`));
        playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)(bestSkillWithExp, `${rowClass}td2`));
        const ratingTd = document.createElement("td");
        ratingTd.classList.add(`${rowClass}td1`);
        ratingTd.appendChild((0, $18c53b0039ffc5db$export$83fab2b954b58590)(bestSkillWithExp, (0, $05be6c1d1617fb2b$export$593f2d24ede2dfb0)));
        playerRow.appendChild(ratingTd);
    });
};
var $4cd00c11b313a3a7$export$2e2bcd8739ae039 = $4cd00c11b313a3a7$var$viewPlayerList;





const $47e313680aa18398$var$viewPlayerProfile = ()=>{
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
    const positions = (0, $78fc06ffa0ef6332$export$f424e510a287eb0)(player, (0, $05be6c1d1617fb2b$export$28a5266254550ff3));
    const bestPosition = (0, $78fc06ffa0ef6332$export$fefc44fbabdf230f)(positions);
    const contentColumn = document.querySelector(".column_left");
    /**
   * Ability Box
   */ const abilityBox = document.createElement("div");
    abilityBox.classList.add("player-profile");
    abilityBox.classList.add("player-profile--ability");
    const position1 = document.createElement("div");
    position1.classList.add("ability__position");
    position1.textContent = bestPosition.position;
    const allPositions = document.createElement("div");
    allPositions.classList.add("ability__positions");
    let positionList = ``;
    positions.forEach((position)=>{
        positionList += `<div>${position.position} ${(0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(position.level, player.experience)}</div>`;
    });
    allPositions.innerHTML = positionList;
    abilityBox.appendChild(position1);
    const abilityDescription = document.createElement("div");
    abilityDescription.classList.add("ability__text");
    const abilityValue = document.createElement("div");
    abilityValue.innerHTML = `<div>${(0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.level, player.experience)}</div>
   <div>(${bestPosition.level})</div>`;
    const comparison = document.createElement("div");
    comparison.classList.add("comparison");
    comparison.appendChild((0, $18c53b0039ffc5db$export$83fab2b954b58590)((0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.level, player.experience), (0, $05be6c1d1617fb2b$export$593f2d24ede2dfb0)));
    abilityDescription.appendChild(abilityValue);
    abilityDescription.appendChild(comparison);
    abilityBox.appendChild(abilityDescription);
    abilityBox.appendChild(allPositions);
    contentColumn.appendChild(abilityBox);
    /**
   * Potential Box
   */ const potentialBox = document.createElement("div");
    potentialBox.classList.add("player-profile");
    potentialBox.classList.add("player-profile--potential");
    const potentials = (0, $78fc06ffa0ef6332$export$bf339f9dce5a47df)(player, (0, $05be6c1d1617fb2b$export$28a5266254550ff3));
    const bestPotential = (0, $78fc06ffa0ef6332$export$82338cb6413791b1)(potentials);
    const potentialBadge = (0, $18c53b0039ffc5db$export$1e190777fe7d790a)(bestPotential.potential);
    potentialBox.appendChild(potentialBadge);
    const potentialDescription = (0, $18c53b0039ffc5db$export$c1975daa4eb91b44)(bestPotential);
    potentialBox.appendChild(potentialDescription);
    const allPotentials = document.createElement("div");
    allPotentials.classList.add("potential__positions");
    let potentialList = ``;
    potentials.forEach((potential)=>{
        potentialList += `<div>${potential.position} ${potential.potential}</div>`;
    });
    allPotentials.innerHTML = potentialList;
    potentialBox.appendChild(allPotentials);
    contentColumn.appendChild(potentialBox);
};
var $47e313680aa18398$export$2e2bcd8739ae039 = $47e313680aa18398$var$viewPlayerProfile;





const $49e9dbd41eda08ef$var$viewLineupChange = ()=>{
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
            if (playerColumns.length > 2) {
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
                const skills = (0, $78fc06ffa0ef6332$export$f424e510a287eb0)(player, (0, $05be6c1d1617fb2b$export$28a5266254550ff3));
                const bestPosition = (0, $78fc06ffa0ef6332$export$fefc44fbabdf230f)(skills);
                const bestSkillWithExp = (0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.level, player.experience);
                playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)(bestPosition.position, `${rowClass}td1`));
                playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)((0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.level, player.experience), `${rowClass}td2`));
                const ratingTd = document.createElement("td");
                ratingTd.classList.add(`${rowClass}td1`);
                ratingTd.appendChild((0, $18c53b0039ffc5db$export$83fab2b954b58590)(bestSkillWithExp, (0, $05be6c1d1617fb2b$export$593f2d24ede2dfb0)));
                playerRow.appendChild(ratingTd);
            } else playerColumns[1].colSpan = 16;
        });
    });
};
var $49e9dbd41eda08ef$export$2e2bcd8739ae039 = $49e9dbd41eda08ef$var$viewLineupChange;





const $003292cd27b2be11$var$viewLineupChange = ()=>{
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
                goalie: playerColumns[playerColumns.length - 10].textContent,
                defence: playerColumns[playerColumns.length - 9].textContent,
                offence: playerColumns[playerColumns.length - 8].textContent,
                shooting: playerColumns[playerColumns.length - 7].textContent,
                passing: playerColumns[playerColumns.length - 6].textContent,
                technical: playerColumns[playerColumns.length - 5].textContent,
                aggression: playerColumns[playerColumns.length - 4].textContent
            },
            experience: parseInt(playerColumns[playerColumns.length - 3].textContent)
        };
        const rowClass = index % 2 === 0 ? "tr1" : "tr0";
        const skills = (0, $78fc06ffa0ef6332$export$f424e510a287eb0)(player, (0, $05be6c1d1617fb2b$export$28a5266254550ff3));
        const bestPosition = (0, $78fc06ffa0ef6332$export$fefc44fbabdf230f)(skills);
        const bestSkillWithExp = (0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.level, player.experience);
        playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)(bestPosition.position, `${rowClass}td1`));
        playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)((0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.level, player.experience), `${rowClass}td2`));
        const ratingTd = document.createElement("td");
        ratingTd.classList.add(`${rowClass}td1`);
        ratingTd.appendChild((0, $18c53b0039ffc5db$export$83fab2b954b58590)(bestSkillWithExp, (0, $05be6c1d1617fb2b$export$593f2d24ede2dfb0)));
        playerRow.appendChild(ratingTd);
    });
};
var $003292cd27b2be11$export$2e2bcd8739ae039 = $003292cd27b2be11$var$viewLineupChange;





/**
 * View Functions
 */ const $5ccfa3f7960e806b$var$viewMarket = ()=>{
    const tableHeads = document.getElementById("table-1").querySelectorAll("thead");
    const playerRows = document.getElementById("table-1").querySelector("tbody").querySelectorAll("tr");
    tableHeads.forEach((head)=>{
        head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("Pos", "th1"));
        head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("Sk", "th2"));
        head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("Rating", "th1"));
        head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("Grd", "th2"));
    });
    const getSkill = (column)=>{
        return parseInt([].reduce.call(column.childNodes, (a, b)=>{
            return a + (b.nodeType === 3 ? b.textContent : "");
        }, ""));
    };
    playerRows.forEach((playerRow, index)=>{
        const playerColumns = playerRow.querySelectorAll("td");
        const playerQualities = playerRow.querySelectorAll(".kva");
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
            qualities: {
                goalie: parseInt(playerQualities[0].textContent),
                defence: parseInt(playerQualities[1].textContent),
                offence: parseInt(playerQualities[2].textContent),
                shooting: parseInt(playerQualities[3].textContent),
                passing: parseInt(playerQualities[4].textContent),
                technical: parseInt(playerQualities[5].textContent),
                aggression: parseInt(playerQualities[6].textContent)
            },
            experience: parseInt(playerColumns[12].textContent),
            overall: playerColumns[13].textContent
        };
        const rowClass = index % 2 === 0 ? "tr1" : "tr0";
        const skills = (0, $78fc06ffa0ef6332$export$f424e510a287eb0)(player, (0, $05be6c1d1617fb2b$export$28a5266254550ff3));
        const bestPosition = (0, $78fc06ffa0ef6332$export$fefc44fbabdf230f)(skills);
        const bestSkillWithExp = (0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.level, player.experience);
        playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)(bestPosition.position, `${rowClass}td1`));
        playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)(bestSkillWithExp, `${rowClass}td2`));
        const ratingTd = document.createElement("td");
        ratingTd.classList.add(`${rowClass}td1`);
        ratingTd.appendChild((0, $18c53b0039ffc5db$export$83fab2b954b58590)(bestSkillWithExp, (0, $05be6c1d1617fb2b$export$593f2d24ede2dfb0)));
        playerRow.appendChild(ratingTd);
        const bestPotential = (0, $78fc06ffa0ef6332$export$82338cb6413791b1)((0, $78fc06ffa0ef6332$export$bf339f9dce5a47df)(player, (0, $05be6c1d1617fb2b$export$28a5266254550ff3)));
        const potentialBadge = (0, $18c53b0039ffc5db$export$1e190777fe7d790a)(bestPotential.potential, "small");
        const potentialTd = document.createElement("td");
        potentialTd.classList.add(`${rowClass}td2`);
        potentialTd.classList.add("td-center");
        potentialTd.appendChild(potentialBadge);
        playerRow.appendChild(potentialTd);
    });
};
var $5ccfa3f7960e806b$export$2e2bcd8739ae039 = $5ccfa3f7960e806b$var$viewMarket;





const $938b3fb7a05b1e09$var$viewTraining = ()=>{
    const tableHeads = document.getElementById("table-1").querySelectorAll("thead");
    const playerRows = document.getElementById("table-1").querySelector("tbody").querySelectorAll("tr");
    tableHeads.forEach((head)=>{
        head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("Grd", "th1"));
    });
    playerRows.forEach((playerRow, index)=>{
        const rowClass = index % 2 === 0 ? "tr1" : "tr0";
        const playerQualities = playerRow.querySelectorAll(".kva");
        const player = {
            qualities: {
                goalie: parseInt(playerQualities[0].textContent),
                defence: parseInt(playerQualities[1].textContent),
                offence: parseInt(playerQualities[2].textContent),
                shooting: parseInt(playerQualities[3].textContent),
                passing: parseInt(playerQualities[4].textContent),
                technical: parseInt(playerQualities[5].textContent),
                aggression: parseInt(playerQualities[6].textContent)
            }
        };
        const bestPotential = (0, $78fc06ffa0ef6332$export$82338cb6413791b1)((0, $78fc06ffa0ef6332$export$bf339f9dce5a47df)(player, (0, $05be6c1d1617fb2b$export$28a5266254550ff3)));
        const potentialBadge = (0, $18c53b0039ffc5db$export$1e190777fe7d790a)(bestPotential.potential, "small");
        const potentialTd = document.createElement("td");
        potentialTd.classList.add(`${rowClass}td1`);
        potentialTd.classList.add("td-center");
        potentialTd.appendChild(potentialBadge);
        playerRow.appendChild(potentialTd);
    });
};
var $938b3fb7a05b1e09$export$2e2bcd8739ae039 = $938b3fb7a05b1e09$var$viewTraining;


/**
 * Run View Functions
 */ const $73e5c51a6eddb90a$var$initHockey = ()=>{
    if (window.location.href.includes("speletaju-parskats")) (0, $4cd00c11b313a3a7$export$2e2bcd8739ae039)();
    if (window.location.href.includes("speletajs")) (0, $47e313680aa18398$export$2e2bcd8739ae039)();
    if (window.location.href.includes("mainas")) (0, $49e9dbd41eda08ef$export$2e2bcd8739ae039)();
    if (window.location.href.includes("speletaju-trenini")) (0, $938b3fb7a05b1e09$export$2e2bcd8739ae039)();
    if (window.location.href.includes("rediget-mainu")) (0, $003292cd27b2be11$export$2e2bcd8739ae039)();
    if (window.location.href.includes("/lv/tirgus")) (0, $5ccfa3f7960e806b$export$2e2bcd8739ae039)();
};
var $73e5c51a6eddb90a$export$2e2bcd8739ae039 = $73e5c51a6eddb90a$var$initHockey;


const $d72e2c82b342b23f$export$28a5266254550ff3 = [
    {
        name: "GK",
        ratios: {
            goalie: 1,
            technical: 0.75,
            speed: 0.75,
            passing: 0.25,
            heading: 0.25
        }
    },
    {
        name: "SD",
        ratios: {
            defence: 1,
            technical: 0.5,
            speed: 0.75,
            passing: 0.5,
            heading: 0.25
        }
    },
    {
        name: "CD",
        ratios: {
            defence: 1,
            technical: 0.5,
            speed: 0.5,
            passing: 0.5,
            heading: 0.5
        }
    },
    {
        name: "SM",
        ratios: {
            midfield: 1,
            technical: 0.5,
            speed: 0.75,
            passing: 0.5,
            heading: 0.25
        }
    },
    {
        name: "CM",
        ratios: {
            midfield: 1,
            technical: 0.75,
            speed: 0.25,
            passing: 0.75,
            heading: 0.25
        }
    },
    {
        name: "SF",
        ratios: {
            offence: 1,
            technical: 0.75,
            speed: 0.75,
            passing: 0.5,
            heading: 0.25
        }
    },
    {
        name: "CF",
        ratios: {
            offence: 1,
            technical: 0.5,
            speed: 0.75,
            passing: 0.25,
            heading: 0.25
        }
    }, 
];
const $d72e2c82b342b23f$export$593f2d24ede2dfb0 = {
    low: 300,
    medium: 600,
    high: 900
};




const $16d6774ae8f01de0$var$viewPlayerList = ()=>{
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
                midfield: playerColumns[8].textContent,
                offence: playerColumns[9].textContent,
                shooting: playerColumns[10].textContent,
                passing: playerColumns[11].textContent,
                technical: playerColumns[12].textContent,
                speed: playerColumns[13].textContent,
                heading: playerColumns[14].textContent
            },
            experience: parseInt(playerColumns[15].textContent),
            overall: playerColumns[16].textContent
        };
        const rowClass = index % 2 === 0 ? "tr1" : "tr0";
        const skills = (0, $78fc06ffa0ef6332$export$f424e510a287eb0)(player, (0, $d72e2c82b342b23f$export$28a5266254550ff3));
        const bestPosition = (0, $78fc06ffa0ef6332$export$fefc44fbabdf230f)(skills);
        const bestSkillWithExp = (0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.level, player.experience);
        playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)(bestPosition.position, `${rowClass}td1`));
        playerRow.appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)(bestSkillWithExp, `${rowClass}td2`));
        const ratingTd = document.createElement("td");
        ratingTd.classList.add(`${rowClass}td1`);
        ratingTd.appendChild((0, $18c53b0039ffc5db$export$83fab2b954b58590)(bestSkillWithExp, (0, $d72e2c82b342b23f$export$593f2d24ede2dfb0)));
        playerRow.appendChild(ratingTd);
    });
};
var $16d6774ae8f01de0$export$2e2bcd8739ae039 = $16d6774ae8f01de0$var$viewPlayerList;





const $711c76ff1e59871f$var$viewPlayerProfile = ()=>{
    const playerTable = document.getElementById("table-1");
    const player = {
        careerLongitivity: parseInt(Array.from(playerTable.querySelector("#life_time span").textContent)[0]),
        skills: {
            goalie: parseInt(playerTable.querySelector("#goalie").textContent),
            defence: parseInt(playerTable.querySelector("#defense").textContent),
            midfield: parseInt(playerTable.querySelector("#midfield").textContent),
            offence: parseInt(playerTable.querySelector("#attack").textContent),
            shooting: parseInt(playerTable.querySelector("#shooting").textContent),
            passing: parseInt(playerTable.querySelector("#passing").textContent),
            technical: parseInt(playerTable.querySelector("#technique_attribute").textContent),
            speed: parseInt(playerTable.querySelector("#speed").textContent),
            heading: parseInt(playerTable.querySelector("#heading").textContent)
        },
        qualities: {
            goalie: parseInt(playerTable.querySelector("#kva_goalie").textContent),
            defence: parseInt(playerTable.querySelector("#kva_defense").textContent),
            midfield: parseInt(playerTable.querySelector("#kva_midfield").textContent),
            offence: parseInt(playerTable.querySelector("#kva_attack").textContent),
            shooting: parseInt(playerTable.querySelector("#kva_shooting").textContent),
            passing: parseInt(playerTable.querySelector("#kva_passing").textContent),
            technical: parseInt(playerTable.querySelector("#technique_quality").textContent),
            speed: parseInt(playerTable.querySelector("#kva_speed").textContent),
            heading: parseInt(playerTable.querySelector("#kva_heading").textContent)
        },
        experience: parseInt(playerTable.querySelector("#experience").textContent),
        overall: playerTable.querySelector("#index_skill").textContent
    };
    const positions = (0, $78fc06ffa0ef6332$export$f424e510a287eb0)(player, (0, $d72e2c82b342b23f$export$28a5266254550ff3));
    const bestPosition = (0, $78fc06ffa0ef6332$export$fefc44fbabdf230f)(positions);
    const contentColumn = document.querySelector(".column_left");
    /**
   * Ability Box
   */ const abilityBox = document.createElement("div");
    abilityBox.classList.add("player-profile");
    abilityBox.classList.add("player-profile--ability");
    const position1 = document.createElement("div");
    position1.classList.add("ability__position");
    position1.textContent = bestPosition.position;
    const allPositions = document.createElement("div");
    allPositions.classList.add("ability__positions");
    let positionList = ``;
    positions.forEach((position)=>{
        positionList += `<div>${position.position} ${(0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(position.level, player.experience)}</div>`;
    });
    allPositions.innerHTML = positionList;
    abilityBox.appendChild(position1);
    const abilityDescription = document.createElement("div");
    abilityDescription.classList.add("ability__text");
    const abilityValue = document.createElement("div");
    abilityValue.innerHTML = `<div>${(0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.level, player.experience)}</div>
  <div>(${bestPosition.level})</div>`;
    const comparison = document.createElement("div");
    comparison.classList.add("comparison");
    comparison.appendChild((0, $18c53b0039ffc5db$export$83fab2b954b58590)((0, $78fc06ffa0ef6332$export$5898f23eb7acb0be)(bestPosition.level, player.experience), (0, $d72e2c82b342b23f$export$593f2d24ede2dfb0)));
    abilityDescription.appendChild(abilityValue);
    abilityDescription.appendChild(comparison);
    abilityBox.appendChild(abilityDescription);
    abilityBox.appendChild(allPositions);
    contentColumn.appendChild(abilityBox);
    /**
   * Potential Box
   */ const potentialBox = document.createElement("div");
    potentialBox.classList.add("player-profile");
    potentialBox.classList.add("player-profile--potential");
    const potentials = (0, $78fc06ffa0ef6332$export$bf339f9dce5a47df)(player, (0, $d72e2c82b342b23f$export$28a5266254550ff3));
    const bestPotential = (0, $78fc06ffa0ef6332$export$82338cb6413791b1)(potentials);
    const potentialBadge = (0, $18c53b0039ffc5db$export$1e190777fe7d790a)(bestPotential.potential);
    potentialBox.appendChild(potentialBadge);
    const potentialDescription = (0, $18c53b0039ffc5db$export$c1975daa4eb91b44)(bestPotential);
    potentialBox.appendChild(potentialDescription);
    const allPotentials = document.createElement("div");
    allPotentials.classList.add("potential__positions");
    let potentialList = ``;
    potentials.forEach((potential)=>{
        potentialList += `<div>${potential.position} ${potential.potential}</div>`;
    });
    allPotentials.innerHTML = potentialList;
    potentialBox.appendChild(allPotentials);
    contentColumn.appendChild(potentialBox);
};
var $711c76ff1e59871f$export$2e2bcd8739ae039 = $711c76ff1e59871f$var$viewPlayerProfile;





const $330661c0fd2d6392$var$viewTraining = ()=>{
    const tableHeads = document.getElementById("table-1").querySelectorAll("thead");
    const playerRows = document.getElementById("table-1").querySelector("tbody").querySelectorAll("tr");
    tableHeads.forEach((head)=>{
        head.querySelector("tr").appendChild((0, $18c53b0039ffc5db$export$b36ad6a61166502b)("Grd", "th1"));
    });
    playerRows.forEach((playerRow, index)=>{
        const rowClass = index % 2 === 0 ? "tr1" : "tr0";
        const playerQualities = playerRow.querySelectorAll(".kva");
        const player = {
            qualities: {
                goalie: parseInt(playerQualities[0].textContent),
                defence: parseInt(playerQualities[1].textContent),
                midfield: parseInt(playerQualities[2].textContent),
                offence: parseInt(playerQualities[3].textContent),
                shooting: parseInt(playerQualities[4].textContent),
                passing: parseInt(playerQualities[5].textContent),
                technical: parseInt(playerQualities[6].textContent),
                speed: parseInt(playerQualities[7].textContent),
                heading: parseInt(playerQualities[8].textContent)
            }
        };
        const bestPotential = (0, $78fc06ffa0ef6332$export$82338cb6413791b1)((0, $78fc06ffa0ef6332$export$bf339f9dce5a47df)(player, (0, $d72e2c82b342b23f$export$28a5266254550ff3)));
        const potentialBadge = (0, $18c53b0039ffc5db$export$1e190777fe7d790a)(bestPotential.potential, "small");
        const potentialTd = document.createElement("td");
        potentialTd.classList.add(`${rowClass}td1`);
        potentialTd.classList.add("td-center");
        potentialTd.appendChild(potentialBadge);
        playerRow.appendChild(potentialTd);
    });
};
var $330661c0fd2d6392$export$2e2bcd8739ae039 = $330661c0fd2d6392$var$viewTraining;


/**
 * Run View Functions
 */ const $51b5e71d03992dd2$var$initSoccer = ()=>{
    if (window.location.href.includes("speletaju-parskats")) (0, $16d6774ae8f01de0$export$2e2bcd8739ae039)();
    if (window.location.href.includes("speletajs")) (0, $711c76ff1e59871f$export$2e2bcd8739ae039)();
    // if (window.location.href.includes("mainas")) viewLineup();
    if (window.location.href.includes("speletaju-trenini")) (0, $330661c0fd2d6392$export$2e2bcd8739ae039)();
// if (window.location.href.includes("rediget-mainu")) viewLineupChange();
// if (window.location.href.includes("/lv/tirgus")) viewMarket();
};
var $51b5e71d03992dd2$export$2e2bcd8739ae039 = $51b5e71d03992dd2$var$initSoccer;


if (window.location.href.includes("hockey.powerplaymanager.com")) (0, $73e5c51a6eddb90a$export$2e2bcd8739ae039)();
if (window.location.href.includes("soccer.powerplaymanager.com")) (0, $51b5e71d03992dd2$export$2e2bcd8739ae039)();


//# sourceMappingURL=main.js.map
