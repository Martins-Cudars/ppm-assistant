import { getLocalizedPageForLang } from "@/sports/routeDispatch";

// Checked against the live menu in both languages (2026-10-01). Soccer's
// profile is "player" like hockey's, not basketball's "player-profile".
const routes = {
  playersOverview: ["/en/overview-of-players", "/lv/speletaju-parskats"],
  playerProfile: ["/en/player", "/lv/speletajs"],
  playerTraining: ["/en/players-practice", "/lv/speletaju-trenini"],
  lines: ["/en/lineup", "/lv/sastavs", "/lv/izkartojuma-versija"],
  market: ["/en/player-market", "/lv/speletaju-tirgus"],
  trainingCamp: ["/en/training-camp", "/lv/treninnometne"],
  trainingProgress: ["/en/training-progress", "/lv/treninu-progress"],
} as const;

export default routes;

/** The profile page's file name in a language, e.g. "lv" -> "speletajs.html". */
export function getSoccerPlayerPageForLang(lang: string): string {
  return getLocalizedPageForLang(routes.playerProfile, lang, "player.html");
}
