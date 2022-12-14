import { potentialGrade } from "./utilities.js";

const renderTableCell = (content, cssClass) => {
  const cell = document.createElement("td");
  cell.classList.add(cssClass);
  cell.textContent = content;
  return cell;
};

const renderComparison = (skill, ratingSettings) => {
  let ratingPercentage;

  const ratingOuter = document.createElement("div");
  const ratingInner = document.createElement("div");

  ratingOuter.classList.add("rating");
  ratingInner.classList.add("rating__inner");

  if (skill < ratingSettings.low) {
    ratingOuter.style.backgroundImage = `url(${chrome.runtime.getURL(
      "icons/star-empty.svg"
    )})`;
    ratingInner.style.backgroundImage = `url(${chrome.runtime.getURL(
      "icons/star-silver.svg"
    )})`;
    ratingPercentage = Math.min((skill / ratingSettings.low) * 100, 100);
  } else if (skill < ratingSettings.medium) {
    ratingOuter.style.backgroundImage = `url(${chrome.runtime.getURL(
      "icons/star-silver.svg"
    )})`;
    ratingInner.style.backgroundImage = `url(${chrome.runtime.getURL(
      "icons/star-gold.svg"
    )})`;
    ratingPercentage = Math.min(
      ((skill - ratingSettings.low) /
        (ratingSettings.medium - ratingSettings.low)) *
        100,
      100
    );
  } else if (skill >= ratingSettings.medium) {
    ratingOuter.style.backgroundImage = `url(${chrome.runtime.getURL(
      "icons/star-gold.svg"
    )})`;
    ratingInner.style.backgroundImage = `url(${chrome.runtime.getURL(
      "icons/star-diamond.svg"
    )})`;
    ratingPercentage = Math.min(
      ((skill - ratingSettings.medium) /
        (ratingSettings.high - ratingSettings.medium)) *
        100,
      100
    );
  }

  ratingInner.style.width = `${ratingPercentage}%`;
  ratingOuter.appendChild(ratingInner);

  return ratingOuter;
};

const renderPotential = (bestPotential) => {
  const potential = document.createElement("div");
  potential.classList.add("potential__text");
  potential.textContent = `Best potential position is ${
    bestPotential.position
  } with ${Math.round(bestPotential.potential)}`;
  return potential;
};

const renderPotentialBadge = (potential, size) => {
  const badge = document.createElement("div");
  badge.classList.add("potential__badge");

  if (size) {
    badge.classList.add(`potential__badge--${size}`);
  }

  const potentialObj = potentialGrade(potential);
  badge.classList.add(`potential__badge--${potentialObj.class}`);

  badge.textContent = potentialObj.label;

  return badge;
};

const renderTrainableSkill = (trainableSkill) => {
  const trainableSkillElement = document.createElement("div");
  trainableSkillElement.classList.add("trainable-skill");
  trainableSkillElement.textContent = `Trainable skill is ${trainableSkill.minimumSkill.skill} with ${trainableSkill.minimumSkill.ability}, needs to improve by ${trainableSkill.difference}`;

  return trainableSkillElement;
};

export {
  renderTableCell,
  renderComparison,
  renderPotential,
  renderPotentialBadge,
  renderTrainableSkill,
};
