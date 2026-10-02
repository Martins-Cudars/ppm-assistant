import { ROSTER_COLUMNS, RosterRow, parseRosterRow, teamIdFromHref } from "@/sports/basketball/parsers/teamRoster";
import { captureScoutSnapshots } from "@/sports/basketball/scoutCapture";
import { bestOrByAge, scoutCoverage } from "@/sports/basketball/scoutReference";
import { exportScoutSnapshots } from "@/storage/scoutSnapshotDb";
import { PUBLIC_ACCOUNT_TEAM_IDS } from "@/storage/publicAccount";
import { getCurrentSeason, getUserTeamId } from "@/utils/dom";
import { showScoutNote } from "./scoutNote";

/**
 * A team's "Players" page (players.html?data=<teamId>, or the user's own
 * without `data`). It lists age, height, AvQ, CL and OR for the whole roster -
 * no skills - so one visit is one scout snapshot per player. Nothing on the
 * page is replaced; a note above the table says what was stored.
 */
const viewTeamRoster = () => {
  const table = document.getElementById("table-1") as HTMLTableElement | null;
  if (!table) return;
  // Another layout under the same id isn't a roster - don't guess at its columns.
  if (table.querySelector("thead tr")?.children.length !== ROSTER_COLUMNS) return;

  const userTeamId = getUserTeamId();
  const teamId =
    teamIdFromHref(window.location.search) ?? (userTeamId !== "unknown" ? userTeamId : null);
  if (!teamId) return;
  // The logged-out demo team's players aren't real.
  if (teamId === PUBLIC_ACCOUNT_TEAM_IDS.basketball) return;

  const rows: RosterRow[] = [];
  table.querySelectorAll("tbody tr").forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll("td"));
    const profileLink = cells[1]?.querySelector(
      'a[href*="player-profile"], a[href*="speletaja-profils"]'
    );
    const row = parseRosterRow(
      cells.map((cell) => cell.textContent ?? ""),
      profileLink?.getAttribute("href") ?? undefined
    );
    if (row) rows.push(row);
  });
  if (rows.length === 0) return;

  const teamName =
    document.querySelector(".ppm_menu_top_profil_name a")?.textContent?.trim() || undefined;
  const season = getCurrentSeason();

  captureScoutSnapshots(rows, {
    teamId,
    teamName,
    season: season?.season,
    seasonDay: season?.seasonDay,
    source: "TeamRoster",
  })
    .then(async (written) => {
      if (written === 0) {
        showScoutNote(table, "could not store this roster.");
        return;
      }
      const all = await exportScoutSnapshots("basketball");
      const coverage = all ? scoutCoverage(all) : null;
      showScoutNote(
        table,
        `stored ${rows.length} players of ${teamName ?? "this team"}` +
          (coverage
            ? `. Scouted so far: ${coverage.players} players, ${coverage.teams} teams, ` +
              `${bestOrByAge(all!).length} ages covered.`
            : ".")
      );
    })
    .catch((error) => console.error("[TeamRoster] Capture failed:", error));
};

export default viewTeamRoster;
