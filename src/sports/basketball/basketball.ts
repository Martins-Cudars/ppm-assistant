import routes from "./routes";

import viewPlayerList from "./views/viewPlayerList";
import viewPlayerProfile from "./views/viewPlayerProfile";
// import viewLineup from "./views/viewLineup";
import viewLineup from "./views/viewLineup";
import viewMarket from "./views/viewMarket";
import viewTraining from "./views/viewTraining";
import viewTrainingProgress from "./views/viewTrainingProgress";
import viewTeamRoster from "@/base/scout/viewTeamRoster";
import viewLeague from "@/base/scout/viewLeague";
import { BASKETBALL_ROSTER } from "@/base/scout/rosterParser";
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
    { routes: routes.trainingProgress, run: viewTrainingProgress },
    { routes: routes.teamPlayers, run: viewTeamRoster("basketball", BASKETBALL_ROSTER) },
    { routes: routes.league, run: viewLeague("basketball") },
  ]);
  // dispatchRoute(window.location.href, [{ routes: routes.trainingCamp, run: viewTrainingCamp }]);
  // TODO: Create next game view
  // dispatchRoute(window.location.href, [{ routes: routes.nextGame, run: viewNextGame }]);
};

export default initBasketball;
