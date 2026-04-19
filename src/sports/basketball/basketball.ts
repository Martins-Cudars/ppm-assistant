import routes from "./routes";

import viewPlayerList from "./views/viewPlayerList";
import viewPlayerProfile from "./views/viewPlayerProfile";
// import viewLineup from "./views/viewLineup";
import viewLineup from "./views/viewLineup";
import viewMarket from "./views/viewMarket";
import viewTraining from "./views/viewTraining";
// import viewTrainingCamp from "./views/viewTrainingCamp";
import { dispatchRoute } from "@/sports/routeDispatch";

/**
 * Run View Functions
 */

const initBasketball = () => {
  dispatchRoute(window.location.href, [
    { routes: routes.playersOverview, run: viewPlayerList },
    { routes: routes.playerProfile, run: viewPlayerProfile },
    { routes: routes.playerTraining, run: viewTraining },
    { routes: routes.lines, run: viewLineup },
    { routes: routes.market, run: viewMarket },
  ]);
  // dispatchRoute(window.location.href, [{ routes: routes.trainingCamp, run: viewTrainingCamp }]);
  // TODO: Create next game view
  // dispatchRoute(window.location.href, [{ routes: routes.nextGame, run: viewNextGame }]);
};

export default initBasketball;
