import routes from "./routes";

import viewPlayerList from "./views/viewPlayerList";
import viewPlayerProfile from "./views/viewPlayerProfile";
import viewLineup from "./views/viewLineup";
import viewLineupChange from "./views/viewLineupChange";
import viewMarket from "./views/viewMarket";
import viewTraining from "./views/viewTraining";
import viewTrainingCamp from "./views/viewTrainingCamp";
import viewPlayerContracts from "./views/viewPlayerContracts";
import { clearInvalidCaches } from "@/storage/playerCache";
import { dispatchRoute } from "@/sports/routeDispatch";

/**
 * Run View Functions
 */

const initHockey = () => {
  // Clean up any invalid cache entries on startup
  clearInvalidCaches().catch((error) => {
    console.error("[Hockey] Failed to clear invalid caches:", error);
  });

  dispatchRoute(window.location.href, [
    { routes: routes.playersOverview, run: viewPlayerList },
    { routes: routes.playerProfile, run: viewPlayerProfile },
    { routes: routes.playerTraining, run: viewTraining },
    { routes: routes.lines, run: viewLineup },
    { routes: routes.editLine, run: viewLineupChange },
    { routes: routes.market, run: viewMarket },
    { routes: routes.trainingCamp, run: viewTrainingCamp },
    { routes: routes.contracts, run: viewPlayerContracts },
  ]);

  // TODO: Create next game view
  // dispatchRoute(window.location.href, [{ routes: routes.nextGame, run: viewNextGame }]);
};

export default initHockey;
