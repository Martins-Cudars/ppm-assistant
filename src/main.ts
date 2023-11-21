import initHockey from "@/sports/hockey/hockey";
import initSoccer from "@/sports/soccer/soccer";
import initBasketball from "@/sports/basketball/basketball";

if (window.location.href.includes("hockey.powerplaymanager.com")) initHockey();

if (window.location.href.includes("soccer.powerplaymanager.com")) initSoccer();

if (window.location.href.includes("basketball.powerplaymanager.com"))
  initBasketball();
