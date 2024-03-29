import viewPlayerList from "./views/viewPlayerList";
import viewPlayerProfile from "./views/viewPlayerProfile";
import viewLineup from "./views/viewLineup";
import viewMarket from "./views/viewMarket";
import viewTraining from "./views/viewTraining";
import viewTrainingCamp from "./views/viewTrainingCamp";

/**
 * Run View Functions
 */

const initSoccer = () => {
  if (window.location.href.includes("speletaju-parskats")) viewPlayerList();
  if (window.location.href.includes("speletajs")) viewPlayerProfile();
  if (
    window.location.href.includes("sastavs") ||
    window.location.href.includes("izkartojuma-versija")
  )
    viewLineup();
  if (window.location.href.includes("speletaju-trenini")) viewTraining();
  // if (window.location.href.includes("rediget-mainu")) viewLineupChange();
  if (window.location.href.includes("speletaju-tirgus")) viewMarket();
  if (window.location.href.includes("treninnometne")) viewTrainingCamp();
};

export default initSoccer;
