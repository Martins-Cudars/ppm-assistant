import routes from "./routes";
import viewPlayerList from "./views/viewPlayerList";
import viewPlayerProfile from "./views/viewPlayerProfile";
import viewLineup from "./views/viewLineup";
import viewMarket from "./views/viewMarket";
import viewTraining from "./views/viewTraining";
import viewTrainingCamp from "./views/viewTrainingCamp";
import viewTrainingProgress from "./views/viewTrainingProgress";
import { dispatchRoute } from "@/sports/routeDispatch";
import viewTeamRoster from "@/base/scout/viewTeamRoster";
import viewLeague from "@/base/scout/viewLeague";
import { SOCCER_ROSTER } from "@/base/scout/rosterParser";

/**
 * Run View Functions
 */

const initSoccer = () => {
  dispatchRoute(window.location.href, [
    { routes: routes.playersOverview, run: viewPlayerList },
    { routes: routes.playerProfile, run: viewPlayerProfile },
    { routes: routes.lines, run: viewLineup },
    { routes: routes.playerTraining, run: viewTraining },
    { routes: routes.market, run: viewMarket },
    { routes: routes.trainingCamp, run: viewTrainingCamp },
    { routes: routes.trainingProgress, run: viewTrainingProgress },
    { routes: routes.teamPlayers, run: viewTeamRoster("soccer", SOCCER_ROSTER) },
    { routes: routes.league, run: viewLeague("soccer") },
  ]);
};

export default initSoccer;
