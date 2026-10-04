import {
  RosterLayout,
  RosterRow,
  parseRosterRow,
  profileHrefOf,
  teamIdFromHref,
} from "@/base/scout/rosterParser";
import { captureScoutSnapshots } from "@/base/scout/scoutCapture";
import { getScoutCoverage } from "@/storage/scoutSnapshotDb";
import { PUBLIC_ACCOUNT_TEAM_IDS } from "@/storage/publicAccount";
import { Sport } from "@/types/Sport";
import { getCurrentSeason, getUserTeamId } from "@/utils/dom";
import { showScoutNote } from "./scoutNote";

/**
 * A team's "Players" page (players.html?data=<teamId>, or the user's own
 * without `data`), in any sport. It lists age, AvQ, CL and OR (and height in
 * basketball) for the whole roster - no skills - so one visit is one scout
 * snapshot per player. Nothing on the page is replaced; a note above the table
 * says what was stored.
 */
const viewTeamRoster = (sport: Sport, layout: RosterLayout) => () => {
  const table = document.getElementById("table-1") as HTMLTableElement | null;
  if (!table) return;
  // Another layout under the same id isn't a roster - don't guess at its columns.
  if (table.querySelector("thead tr")?.children.length !== layout.columns) return;

  const userTeamId = getUserTeamId();
  const teamId =
    teamIdFromHref(window.location.search) ?? (userTeamId !== "unknown" ? userTeamId : null);
  if (!teamId) return;
  // The logged-out demo team's players aren't real.
  if (teamId === PUBLIC_ACCOUNT_TEAM_IDS[sport]) return;

  const rows: RosterRow[] = [];
  table.querySelectorAll("tbody tr").forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll("td"));
    const links = Array.from(cells[layout.name]?.querySelectorAll("a") ?? []);
    const row = parseRosterRow(
      cells.map((cell) => cell.textContent ?? ""),
      profileHrefOf(links.map((link) => link.getAttribute("href"))),
      layout
    );
    if (row) rows.push(row);
  });
  if (rows.length === 0) return;

  const teamName =
    document.querySelector(".ppm_menu_top_profil_name a")?.textContent?.trim() || undefined;
  const season = getCurrentSeason();

  captureScoutSnapshots(
    rows,
    {
      teamId,
      teamName,
      season: season?.season,
      seasonDay: season?.seasonDay,
      source: "TeamRoster",
    },
    sport
  )
    .then(async (written) => {
      if (written === 0) {
        showScoutNote(table, "could not store this roster.");
        return;
      }
      const coverage = await getScoutCoverage(sport);
      showScoutNote(
        table,
        `stored ${rows.length} players of ${teamName ?? "this team"}` +
          (coverage
            ? `. Scouted so far: ${coverage.players} players, ${coverage.teams} teams, ${coverage.ages} ages covered.`
            : ".")
      );
    })
    .catch((error) => console.error("[TeamRoster] Capture failed:", error));
};

export default viewTeamRoster;
