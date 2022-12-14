import viewPlayerList from "./views/viewPlayerList";
import viewPlayerProfile from "./views/viewPlayerProfile";
// import viewLineup from "./views/viewLineup";
// import viewLineupChange from "./views/viewLineupChange";
// import viewMarket from "./views/viewMarket";
import viewTraining from "./views/viewTraining";

/**
 * Run View Functions
 */

const initSoccer = () => {
  if (window.location.href.includes("speletaju-parskats")) viewPlayerList();
  if (window.location.href.includes("speletajs")) viewPlayerProfile();
  // if (window.location.href.includes("mainas")) viewLineup();
  if (window.location.href.includes("speletaju-trenini")) viewTraining();
  // if (window.location.href.includes("rediget-mainu")) viewLineupChange();
  // if (window.location.href.includes("/lv/tirgus")) viewMarket();
};

export default initSoccer;
