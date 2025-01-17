import routes from "./routes";

import viewPlayerList from "./views/viewPlayerList";
import viewPlayerProfile from "./views/viewPlayerProfile";
// import viewLineup from "./views/viewLineup";
import viewLineup from "./views/viewLineup";
import viewMarket from "./views/viewMarket";
import viewTraining from "./views/viewTraining";
// import viewTrainingCamp from "./views/viewTrainingCamp";

/**
 * Run View Functions
 */

const initBasketball = () => {
  const getRoute = (inputUrl: any) => {
    const urlRegex =
      /https?:\/\/(?:\w+\.)?powerplaymanager\.com(\/[\w-]+\/[\w-]+)/;

    const match = inputUrl.match(urlRegex);
    return match[1];
  };

  const url = window.location.href;
  if (routes.playersOverview.includes(getRoute(url))) viewPlayerList();
  if (routes.playerProfile.includes(getRoute(url))) viewPlayerProfile();
  if (routes.playerTraining.includes(getRoute(url))) viewTraining();
  if (routes.lines.includes(getRoute(url))) viewLineup();
  // if (routes.editLine.includes(getRoute(url))) viewLineupChange();
  if (routes.market.includes(getRoute(url))) viewMarket();
  // if (routes.trainingCamp.includes(getRoute(url))) viewTrainingCamp();
  // TODO: Create next game view
  // if (routes.nextGame.includes(getRoute(url))) viewNextGame();
};

export default initBasketball;
