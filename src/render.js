import { ratingSettings } from "./settings.js";

const renderTableCell = (content, cssClass) => {
  const cell = document.createElement("td");
  cell.classList.add(cssClass);
  cell.textContent = content;
  return cell;
};

const renderComparison = (skill) => {
  const ratingPercentage = Math.min((skill / ratingSettings.low) * 100, 100);
  console.log(
    `skill is ${skill}, compared to ${ratingSettings.low}, is ${ratingPercentage}`
  );

  const ratingOuter = document.createElement("div");
  const ratingInner = document.createElement("div");

  ratingOuter.classList.add("rating");
  ratingInner.classList.add("rating__inner");

  ratingInner.setAttribute("style", `width: ${ratingPercentage}%`);
  ratingOuter.setAttribute("alt", `${ratingPercentage}%`);

  ratingOuter.appendChild(ratingInner);

  return ratingOuter;
};

export { renderTableCell, renderComparison };
