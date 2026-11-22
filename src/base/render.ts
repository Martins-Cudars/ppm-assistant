import { potentialGrade } from "@/base/utilities";
import {
  relativePercent,
  relativeSkillClass,
  relativeSkillTitle,
} from "@/base/relativeSkill";
import { RatingSettings } from "@/types/Position";
import type { BasePlayer } from "@/classes/BasePlayer";
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
 * viewer's league when its 100% is known; "–" when the age has no reference.
 * The same markup as src/components/RelativeSkill.vue.
 */
const renderRelativeSkill = (
  playerSkillWithExp: number,
  maxSkill: number | null,
  leagueMaxSkill?: number | null
): HTMLElement => {
  const global = relativePercent(playerSkillWithExp, maxSkill);
  const league = relativePercent(playerSkillWithExp, leagueMaxSkill);

  const span = (className: string, text: string) => {
    const element = document.createElement("span");
    element.className = className;
    element.textContent = text;
    return element;
  };

  const relativeSkillEl = document.createElement("div");
  relativeSkillEl.classList.add("relative-skill");

  if (global === null) {
    relativeSkillEl.appendChild(span("relative-skill__none", "–"));
    return relativeSkillEl;
  }

  relativeSkillEl.appendChild(span(relativeSkillClass(global), `${global}%`));
  if (league !== null) {
    relativeSkillEl.append(
      span("relative-skill__separator", " / "),
      span(relativeSkillClass(league), `${league}%`)
    );
    relativeSkillEl.title = relativeSkillTitle(global, league);
  }

  return relativeSkillEl;
};

/**
 * A player's relative skill for a DOM table: drawn at once with what is known,
 * redrawn with the league value once the league line is fitted.
 */
const renderPlayerRelativeSkill = (player: BasePlayer, playerSkillWithExp: number): HTMLElement => {
  const maxima = player.getRelativeSkillMaxima();
  const element = renderRelativeSkill(playerSkillWithExp, maxima.global, maxima.league);
  if (maxima.league === null) {
    void player.whenRelativeSkillReady().then(() => {
      const next = player.getRelativeSkillMaxima();
      if (next.league !== null) {
        element.replaceWith(renderRelativeSkill(playerSkillWithExp, next.global, next.league));
      }
    });
  }
  return element;
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
  renderPlayerRelativeSkill,
  renderButton,
};
