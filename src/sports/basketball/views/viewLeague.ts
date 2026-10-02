import { parseLeagueIdentity, teamIdFromHref } from "@/sports/basketball/parsers/teamRoster";
import { nextLeagueTeams } from "@/storage/scoutMerge";
import { readLeagueTeams, saveLeagueTeams } from "@/storage/scoutSnapshotDb";
import { getCurrentSeason, getUserTeamId } from "@/utils/dom";
import { showScoutNote } from "./scoutNote";

/**
 * The league table (league.html / liga.html). Saves which teams are in the
 * user's league, which is what the report's LEAGUE line filters by. Whether a
 * page is the user's league, and how its teams combine with the stored list,
 * is decided in nextLeagueTeams().
 */
const viewLeague = async () => {
  const userTeamId = getUserTeamId();
  if (userTeamId === "unknown") return;

  const table = document.querySelector("table.table");
  if (!table) return;

  const selectValue = (name: string) =>
    (document.querySelector(`select[name="${name}"]`) as HTMLSelectElement | null) ?? undefined;
  const country = selectValue("country");
  const identity = parseLeagueIdentity({
    season: selectValue("season")?.value,
    country: country?.value,
    countryName: country?.selectedOptions[0]?.textContent ?? undefined,
    level: selectValue("league_level")?.value,
    number: selectValue("league_number")?.value,
  });
  if (!identity) return;

  const teamIds = Array.from(table.querySelectorAll("a[href*='team.html'], a[href*='komanda.html']"))
    .map((link) => teamIdFromHref(link.getAttribute("href")))
    .filter((id): id is string => id !== null);

  // The default page is the user's league. "Default" is no `data` in the URL -
  // and, in case the league selectors ever navigate without one, the page's
  // level and number matching the header's own-league label ("III.3").
  const headerLeague = document
    .querySelector(".top_info_team a[href*='league.html'], .top_info_team a[href*='liga.html']")
    ?.textContent?.trim();
  const pageLabel = identity.leagueName.split(" ")[0];
  const isDefaultPage =
    !new URLSearchParams(window.location.search).has("data") &&
    (!headerLeague || headerLeague.toUpperCase() === pageLabel);

  const stored = await readLeagueTeams("basketball");
  const next = nextLeagueTeams(
    stored,
    { ...identity, teamIds, isDefaultPage },
    userTeamId,
    getCurrentSeason()?.season ?? null
  );
  if (!next) return;

  await saveLeagueTeams(next, "basketball");
  showScoutNote(
    table,
    `your league ${next.leagueName} saved - ${next.teamIds.length} teams` +
      (teamIds.includes(userTeamId)
        ? "."
        : ". This table doesn't list every team - open League standings for the rest.")
  );
};

export default () => {
  viewLeague().catch((error) => console.error("[League] Capture failed:", error));
};
