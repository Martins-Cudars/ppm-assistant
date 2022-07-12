import viewPlayerList from "./views/viewPlayerList";
import viewPlayerProfile from "./views/viewPlayerProfile";
import viewLineupChange from "./views/viewLineupChange";
import viewMarket from "./views/viewMarket";

/**
 * Run View Functions
 */

if (window.location.href.includes("speletaju-parskats")) viewPlayerList();

if (window.location.href.includes("speletajs")) viewPlayerProfile();

if (window.location.href.includes("rediget-mainu")) viewLineupChange();

if (window.location.href.includes("/lv/tirgus")) viewMarket();
