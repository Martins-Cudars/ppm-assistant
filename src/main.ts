import initHockey from "@/sports/hockey/hockey";
import initSoccer from "@/sports/soccer/soccer";
import initBasketball from "@/sports/basketball/basketball";
import { isPublicAccount } from "@/utils/dom";

// Logged out, the game shows a shared demo team ("Public account"). Nothing on
// it is the user's, and capturing it once replaced the user's squad in the
// Player Report - so the extension stays out entirely: no cache, no history,
// no UI.
if (isPublicAccount()) {
  console.log("[PPM Assistant] Public account (not logged in) - extension inactive");
} else {
  if (window.location.href.includes("hockey.powerplaymanager.com")) initHockey();

  if (window.location.href.includes("soccer.powerplaymanager.com")) initSoccer();

  if (window.location.href.includes("basketball.powerplaymanager.com"))
    initBasketball();
}
