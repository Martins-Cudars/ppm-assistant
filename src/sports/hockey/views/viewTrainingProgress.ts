import { HockeySkills } from "@/sports/hockey/classes/HockeyPlayer";
import { SkillHistoryEntry } from "@/types/SkillHistory";
import { upsertSkillHistoryEntries } from "@/storage/skillHistoryDb";

// Column order on treninu-progress.html: Datums, KR, Vār, Aizs, Uzb, Met, Piesp, Teh, Agr.
// This matches HockeySkills field order 1:1 (goalie, defence, offence, shooting,
// passing, technical, aggression), same as the mapping used in viewTraining.ts.
// NOTE: table id ("table-1") and column indices below follow the convention used
// by every other hockey view (viewPlayerProfile.ts, viewTraining.ts, viewPlayerList.ts)
// but have not been verified against the live page - confirm against real markup
// and adjust if the page differs.
const DATE_COL = 0;
// "KR" is the Latvian label for the overall rating (OR).
const OR_COL = 1;
const SKILL_COLS: (keyof HockeySkills)[] = [
  "goalie", // Vār
  "defence", // Aizs
  "offence", // Uzb
  "shooting", // Met
  "passing", // Piesp
  "technical", // Teh
  "aggression", // Agr
];
const SKILL_COL_START = 2;

/**
 * Reads a cell's flattened text content and parses the leading numeric value,
 * ignoring any trailing "(T:1.26)"-style training multiplier suffix and any
 * thousands-separator whitespace (e.g. "1 078" -> 1078). Using textContent
 * (rather than slicing innerHTML like viewTraining.ts's extractSkill does)
 * makes this resilient to whatever span/class markup wraps the delta/multiplier,
 * since textContent flattens all nested tags automatically.
 */
function parseCellNumber(cell: Element | undefined): number {
  if (!cell) return NaN;
  const raw = (cell.textContent || "").split("(")[0].replace(/\s/g, "");
  return raw.length > 0 ? parseFloat(raw) : NaN;
}

/**
 * Parses the Datums cell into an ISO "YYYY-MM-DD" date string. Prefers a
 * full date embedded in the cell text; falls back to combining a bare
 * day-of-month with the year/month already known from the page's `data`
 * query param.
 */
function parseCellDate(
  cell: Element | undefined,
  fallbackYear: number,
  fallbackMonth: number
): string | null {
  if (!cell) return null;
  const text = (cell.textContent || "").trim();

  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return isoMatch[0];
  }

  const dayMatch = text.match(/(\d{1,2})/);
  if (dayMatch && fallbackYear && fallbackMonth) {
    const day = parseInt(dayMatch[1], 10);
    return `${fallbackYear}-${String(fallbackMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

const viewTrainingProgress = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const dataParam = searchParams.get("data") || "";
  const [playerId, yearMonth] = dataParam.split("-");

  if (!playerId) {
    console.warn("[TrainingProgress] Could not determine player id from URL");
    return;
  }

  // yearMonth is "YYMM", e.g. "2607" -> year 2026, month 07 (July).
  let fallbackYear = 0;
  let fallbackMonth = 0;
  if (yearMonth && yearMonth.length === 4) {
    fallbackYear = 2000 + parseInt(yearMonth.slice(0, 2), 10);
    fallbackMonth = parseInt(yearMonth.slice(2, 4), 10);
  }

  const table = document.getElementById("table-1");
  if (!table) return;

  const tableBody = table.querySelector("tbody");
  if (!tableBody) return;

  const rows = tableBody.querySelectorAll("tr");
  const capturedAt = new Date().toISOString();
  const entries: SkillHistoryEntry[] = [];

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < SKILL_COL_START + SKILL_COLS.length) return;

    const date = parseCellDate(cells[DATE_COL], fallbackYear, fallbackMonth);
    // "KR" is the Latvian label for the overall rating - the same value the
    // player profile exposes as #index_skill - so it's stored under the same
    // field regardless of which page captured it.
    const overallRating = parseCellNumber(cells[OR_COL]);

    const skills = {} as HockeySkills;
    let skillsValid = true;
    SKILL_COLS.forEach((skillKey, index) => {
      const value = parseCellNumber(cells[SKILL_COL_START + index]);
      if (Number.isNaN(value)) {
        skillsValid = false;
      }
      skills[skillKey] = value;
    });

    // Skip rows that fail to parse cleanly - e.g. future days in the current
    // month that haven't happened yet in-game, or days before the player
    // joined the team, typically rendered blank/dash.
    if (!date || Number.isNaN(overallRating) || !skillsValid) return;

    entries.push({
      id: `${playerId}:${date}`,
      playerId,
      date,
      overallRating,
      skills,
      capturedAt,
      source: "TrainingProgress",
    });
  });

  if (entries.length === 0) return;

  upsertSkillHistoryEntries(entries).then(({ written }) => {
    const monthLabel = fallbackMonth
      ? `${fallbackYear}-${String(fallbackMonth).padStart(2, "0")}`
      : "unknown month";
    console.log(
      `[TrainingProgress] Captured ${written} skill history entries for player ${playerId} (${monthLabel})`
    );
  });
};

export default viewTrainingProgress;
