import { ratingSettings } from "./settings.js";

const renderTableCell = (content, cssClass) => {
  const cell = document.createElement("td");
  cell.classList.add(cssClass);
  cell.textContent = content;
  return cell;
};

const renderComparison = (skill) => {
  let ratingPercentage;

  const ratingOuter = document.createElement("div");
  const ratingInner = document.createElement("div");

  ratingOuter.classList.add("rating");
  ratingInner.classList.add("rating__inner");

  if (skill < ratingSettings.low) {
    ratingOuter.classList.add("rating--empty");
    ratingInner.classList.add("rating--silver");
    ratingPercentage = Math.min((skill / ratingSettings.low) * 100, 100);
  } else if (skill < ratingSettings.medium) {
    ratingOuter.classList.add("rating--silver");
    ratingInner.classList.add("rating--gold");
    ratingPercentage = Math.min(
      ((skill - ratingSettings.low) /
        (ratingSettings.medium - ratingSettings.low)) *
        100,
      100
    );
  } else if (skill >= ratingSettings.medium) {
    ratingOuter.classList.add("rating--gold");
    ratingInner.classList.add("rating--diamond");
    ratingPercentage = Math.min(
      ((skill - ratingSettings.medium) /
        (ratingSettings.high - ratingSettings.medium)) *
        100,
      100
    );
  }

  ratingInner.setAttribute("style", `width: ${ratingPercentage}%`);
  ratingOuter.setAttribute("alt", `${ratingPercentage}%`);

  ratingOuter.appendChild(ratingInner);

  return ratingOuter;
};

const renderPotential = (bestPotential) => {
  const potential = document.createElement("div");
  potential.classList.add("potential");
  potential.textContent = `Best potential position is ${
    bestPotential.position
  } with ${Math.round(bestPotential.potential)}`;
  return potential;
};

export { renderTableCell, renderComparison, renderPotential };
