import { potentialGrade } from "@/base/utilities";
import { calculateRelativeSkill } from "@/base/calculations";
import {
  relativePercent,
  relativeSkillClass,
  relativeSkillTitle,
} from "@/base/relativeSkill";
import { RatingSettings } from "@/types/Position";
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
): HTMLSpanElement => {
  let skillAdjusted;

  if (position) {
    const positionSetting = hockeyPositionSettings.find(
      (pos) => pos.name === position
    );
    skillAdjusted = positionSetting
      ? skill * positionSetting.positionRatio
      : skill;
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

/**
 * Relative skill as "82% / 94%": against every scouted team, then against the
 * user's league when `leagueMaxSkill` is given (see src/base/relativeSkill.ts).
 */
const renderRelativeSkill = (
  playerAge: number,
  playerSkillWithExp: number,
  playerGrowthPredictionOrMaxSkill: GrowthPrediction | number,
  leagueMaxSkill?: number
): HTMLElement => {
  const global =
    typeof playerGrowthPredictionOrMaxSkill === "number"
      ? relativePercent(playerSkillWithExp, playerGrowthPredictionOrMaxSkill)
      : calculateRelativeSkill(
          playerAge,
          playerSkillWithExp,
          playerGrowthPredictionOrMaxSkill
        );

  const part = (percent: number) => {
    const span = document.createElement("span");
    span.classList.add(relativeSkillClass(percent));
    span.textContent = `${percent}%`;
    return span;
  };

  const relativeSkillEl = document.createElement("div");
  relativeSkillEl.classList.add("relative-skill");
  relativeSkillEl.style.whiteSpace = "nowrap";
  relativeSkillEl.appendChild(part(global));

  if (leagueMaxSkill !== undefined) {
    const league = relativePercent(playerSkillWithExp, leagueMaxSkill);
    const separator = document.createElement("span");
    separator.textContent = " / ";
    separator.style.fontWeight = "normal";
    separator.style.color = "#999";
    relativeSkillEl.append(separator, part(league));
    relativeSkillEl.title = relativeSkillTitle({ global, league });
  }

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
  renderPotentialBadge,
  renderRelativeSkill,
  renderButton,
};
