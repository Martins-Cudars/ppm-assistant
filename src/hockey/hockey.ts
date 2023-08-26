import routes from "./routes";

import viewPlayerList from "./views/viewPlayerList";
import viewPlayerProfile from "./views/viewPlayerProfile";
import viewLineup from "./views/viewLineup";
import viewLineupChange from "./views/viewLineupChange";
import viewMarket from "./views/viewMarket";
import viewTraining from "./views/viewTraining";
import viewTrainingCamp from "./views/viewTrainingCamp";

/**
 * Run View Functions
 */

const initHockey = () => {
  const urlRegex =
    /https?:\/\/(?:\w+\.)?powerplaymanager\.com(\/[\w-]+\/[\w-]+)/;

  const getRoute = (inputUrl: string) => {
    const match = inputUrl.match(urlRegex);
    if (!match || !match[1]) throw new Error("Invalid URL");

    return match[1];
  };

  // check if we are on player list page
  // if yes, run viewPlayerList function

  const url = window.location.href;

  if (routes.playersOverview.includes(getRoute(url))) viewPlayerList();
  if (routes.playerProfile.includes(getRoute(url))) viewPlayerProfile();
  if (routes.playerTraining.includes(getRoute(url))) viewTraining();
  if (routes.lines.includes(getRoute(url))) viewLineup();
  if (routes.editLine.includes(getRoute(url))) viewLineupChange();
  if (routes.market.includes(getRoute(url))) viewMarket();
  if (routes.trainingCamp.includes(getRoute(url))) viewTrainingCamp();

  // TODO: Create next game view
  // if (routes.nextGame.includes(getRoute(url))) viewNextGame();
};

export default initHockey;
