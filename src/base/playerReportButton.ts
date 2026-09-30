import { Sport } from "@/types/Sport";

/**
 * The "📊 Player Report" button injected above a squad overview. Opens the
 * report on that sport's tab (player-report.html?sport=...).
 */
export function createPlayerReportButton(sport: Sport): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = "📊 Player Report";
  // height, line-height and margin are declared deliberately, not redundantly:
  // the game's global button rule sets all three (height: 25px, line-height:
  // 18px, margin: 0 5px), and an injected button inherits whatever it doesn't
  // declare for itself. Left to the game, box-sizing: border-box means the
  // 20px of vertical padding below eats the whole 25px box and the label
  // overflows it.
  button.style.cssText = `
    height: auto;
    line-height: normal;
    margin: 0 0 15px;
    padding: 10px 20px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: background 0.2s;
  `;
  button.onmouseover = () => {
    button.style.background = "#0056b3";
  };
  button.onmouseout = () => {
    button.style.background = "#007bff";
  };
  button.onclick = () => {
    window.open(chrome.runtime.getURL(`player-report.html?sport=${sport}`), "_blank");
  };
  return button;
}
