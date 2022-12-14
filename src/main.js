import initHockey from "~/src/hockey/hockey.js";
import initSoccer from "~/src/soccer/soccer.js";

console.log(window.location.href);

if (window.location.href.includes("hockey.powerplaymanager.com")) initHockey();

if (window.location.href.includes("soccer.powerplaymanager.com")) initSoccer();
