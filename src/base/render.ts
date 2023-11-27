import { potentialGrade } from "@/base/utilities";
import {
  calculateSkillWithExp,
  calculateRelativeSkill,
} from "@/base/calculations";
import { PositionPotential, RatingSettings } from "@/types/Position";

const renderTableCell = (content: string | number, cssClass: string) => {
  const cell = document.createElement("td");
  cell.classList.add(cssClass);
  cell.textContent = content.toString();
  return cell;
};

const renderComparison = (
  skill: number,
  ratingSettings: RatingSettings
): HTMLDivElement => {
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

const renderPotential = (bestPotential: PositionPotential): HTMLDivElement => {
  const potential = document.createElement("div");
  potential.classList.add("potential__text");
  potential.textContent = `Best potential position is ${
    bestPotential.position
  } with ${Math.round(bestPotential.potential)}`;
  return potential;
};

const renderPotentialBadge = (
  potential: number,
  size = "medium"
): HTMLDivElement => {
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

const renderRelativeSkill = (
  playerAge: number,
  playerSkillWithExp: number,
  playerGrowthPrediction: any
): HTMLElement => {
  const relativeSkill = calculateRelativeSkill(
    playerAge,
    playerSkillWithExp,
    playerGrowthPrediction
  );

  const relativeSkillEl = document.createElement("div");
  relativeSkillEl.classList.add("relative-skill");
  relativeSkillEl.innerText = relativeSkill.toString() + "%";
  return relativeSkillEl;
};

const renderButton = (text: string): HTMLButtonElement => {
  const button = document.createElement("button");
  button.innerText = text;
  return button;
};

export {
  renderTableCell,
  renderComparison,
  renderPotential,
  renderPotentialBadge,
  renderRelativeSkill,
  renderButton,
};
