import { potentialGrade } from "@/base/utilities";
import { calculateRelativeSkill } from "@/base/calculations";
import { PositionPotential, RatingSettings } from "@/types/Position";
import { GrowthPrediction } from "@/types/GrowthData";
import { positionSettings as hockeyPositionSettings } from "@/sports/hockey/settings";

const renderTableCell = (content: string | number, cssClass: string) => {
  const cell = document.createElement("td");
  cell.classList.add(cssClass);
  cell.textContent = content.toString();
  return cell;
};

const renderComparison = (
  skill: number,
  ratingSettings: RatingSettings,
  position?: string
): HTMLDivElement => {
  let skillAdjusted;

  if (position) {
    const positionRatio = hockeyPositionSettings.find(
      (pos) => pos.name === position
    )!.positionRatio;
    skillAdjusted = skill * positionRatio;
  } else {
    skillAdjusted = skill;
  }

  let ratingPercentage;

  const ratingOuter = document.createElement("span");
  const ratingInner = document.createElement("span");

  ratingOuter.classList.add("rating");
  ratingInner.classList.add("rating__inner");

  if (skillAdjusted < ratingSettings.low) {
    ratingOuter.style.backgroundImage = `url(${chrome.runtime.getURL(
      "icons/star-empty.svg"
    )})`;
    ratingInner.style.backgroundImage = `url(${chrome.runtime.getURL(
      "icons/star-silver.svg"
    )})`;
    ratingPercentage = Math.min(
      (skillAdjusted / ratingSettings.low) * 100,
      100
    );
  } else if (skillAdjusted < ratingSettings.medium) {
    ratingOuter.style.backgroundImage = `url(${chrome.runtime.getURL(
      "icons/star-silver.svg"
    )})`;
    ratingInner.style.backgroundImage = `url(${chrome.runtime.getURL(
      "icons/star-gold.svg"
    )})`;
    ratingPercentage = Math.min(
      ((skillAdjusted - ratingSettings.low) /
        (ratingSettings.medium - ratingSettings.low)) *
        100,
      100
    );
  } else if (skillAdjusted >= ratingSettings.medium) {
    ratingOuter.style.backgroundImage = `url(${chrome.runtime.getURL(
      "icons/star-gold.svg"
    )})`;
    ratingInner.style.backgroundImage = `url(${chrome.runtime.getURL(
      "icons/star-diamond.svg"
    )})`;
    ratingPercentage = Math.min(
      ((skillAdjusted - ratingSettings.medium) /
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
  potential.textContent = `Current position (${
    bestPotential.position
  }) training quality is ${Math.round(bestPotential.potential)}`;
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
  playerGrowthPrediction: GrowthPrediction
): HTMLElement => {
  const relativeSkill = calculateRelativeSkill(
    playerAge,
    playerSkillWithExp,
    playerGrowthPrediction
  );

  // floor relative skill to 5s
  const relativeSkillRounded = Math.floor(relativeSkill / 5) * 5;

  const relativeSkillEl = document.createElement("div");
  relativeSkillEl.classList.add("relative-skill");
  relativeSkillEl.classList.add(`relative-skill--${relativeSkillRounded}`);
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
