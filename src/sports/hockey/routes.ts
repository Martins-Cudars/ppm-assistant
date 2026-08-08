import { getLocalizedPageForLang } from "@/sports/routeDispatch";

const routes = {
  playersOverview: ["/en/overview-of-players", "/lv/speletaju-parskats"],
  playerProfile: ["/en/player", "/lv/speletajs"],
  playerTraining: ["/en/players-practice", "/lv/speletaju-trenini"],
  lines: ["/en/lines", "/lv/mainas"],
  editLine: ["/en/edit-line", "/lv/rediget-mainu"],
  nextGame: ["/en/next-game", "/lv/nakosa-spele"],
  market: ["/en/market", "/lv/tirgus"],
  trainingCamp: ["/en/training-camp", "/lv/treninnometne"],
  contracts: ["/en/player-contracts", "/lv/speletaju-ligumi"],
  // EN slug unverified - no reference to this page in English exists anywhere
  // in the codebase. Placeholder guess following the neighboring routes'
  // naming pattern; confirm against the live game (switch to English) before
  // relying on it.
  trainingProgress: ["/en/training-progress", "/lv/treninu-progress"],
};

export default routes;

/**
 * Returns the player profile HTML filename for a given language code.
 * Derived from the playerProfile routes, e.g. "lv" → "speletajs.html".
 * Falls back to "player.html" for unknown languages.
 */
export function getPlayerPageForLang(lang: string): string {
  return getLocalizedPageForLang(routes.playerProfile, lang, "player.html");
}
