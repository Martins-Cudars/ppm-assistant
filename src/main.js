import initHockey from "~/src/hockey/hockey.ts";
import initSoccer from "~/src/soccer/soccer.js";

if (window.location.href.includes("hockey.powerplaymanager.com")) initHockey();

if (window.location.href.includes("soccer.powerplaymanager.com")) initSoccer();
