import { ratingSettings } from "./settings.js";

const renderTableCell = (content, cssClass) => {
  const cell = document.createElement("td");
  cell.classList.add(cssClass);
  cell.textContent = content;
  return cell;
};

const renderComparison = (skill) => {
  const ratingPercentage = Math.min((skill / ratingSettings.low) * 100, 100);

  const ratingOuter = document.createElement("div");
  const ratingInner = document.createElement("div");

  ratingOuter.classList.add("rating");
  ratingInner.classList.add("rating__inner");

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
