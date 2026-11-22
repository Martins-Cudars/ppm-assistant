import { potentialGrade } from "@/base/utilities";
import {
  LeagueLineStatus,
  RelativeSkillMaxima,
  relativeSkillClass,
  relativeSkillView,
} from "@/base/relativeSkill";
import { RatingSettings } from "@/types/Position";
import type { BasePlayer } from "@/classes/BasePlayer";
import type { LeagueLine } from "@/base/scout/leagueRelativeSkill";
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
 * viewer's league; "???" for a value that can't be worked out, with the
 * reason in the tooltip (relativeSkillView). The same markup as
 * src/components/RelativeSkill.vue.
 */
const renderRelativeSkill = (
  playerSkillWithExp: number,
  maxima: RelativeSkillMaxima,
  age: number,
  leagueStatus: LeagueLineStatus
): HTMLElement => {
  const view = relativeSkillView(playerSkillWithExp, maxima, age, leagueStatus);

  const span = (className: string, text: string) => {
    const element = document.createElement("span");
    element.className = className;
    element.textContent = text;
    return element;
  };
  const value = (percent: number | null) =>
    percent === null ? span("relative-skill__none", "???") : span(relativeSkillClass(percent), `${percent}%`);

  const relativeSkillEl = document.createElement("div");
  relativeSkillEl.classList.add("relative-skill");
  relativeSkillEl.title = view.title;
  relativeSkillEl.append(value(view.global), span("relative-skill__separator", " / "), value(view.league));
  return relativeSkillEl;
};

/**
 * A player's relative skill for a DOM table: drawn at once with the global
 * value, redrawn once the view's league line (from loadLeagueReference)
 * arrives - with the league value, or "???" and the reason.
 */
const renderPlayerRelativeSkill = (
  player: BasePlayer,
  playerSkillWithExp: number,
  league: Promise<LeagueLine>
): HTMLElement => {
  const element = renderRelativeSkill(
    playerSkillWithExp,
    player.getRelativeSkillMaxima(null),
    player.age,
    { kind: "loading" }
  );
  void league.then((line) => {
    element.replaceWith(
      renderRelativeSkill(playerSkillWithExp, player.getRelativeSkillMaxima(line.table), player.age, line.status)
    );
  });
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
