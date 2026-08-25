import { createApp, h, reactive } from "vue";
import { HockeySkills } from "@/sports/hockey/classes/HockeyPlayer";
import { SkillHistoryEntry } from "@/types/SkillHistory";
import { upsertSkillHistoryEntries } from "@/storage/skillHistoryDb";
import {
  clearGatherSession,
  readGatherSession,
  writeGatherSession,
} from "@/storage/trainingProgressGather";
import TrainingProgressGather from "@/sports/hockey/views/components/TrainingProgressGather.vue";

// Column order on treninu-progress.html: Datums, KR, Vār, Aizs, Uzb, Met, Piesp, Teh, Agr.
// This matches HockeySkills field order 1:1 (goalie, defence, offence, shooting,
// passing, technical, aggression), same as the mapping used in viewTraining.ts.
// Verified against the live page: the table is #table-1, its header sits in a
// <thead> and the day rows in <tbody>, and the day's trained skill is rendered
// as a trailing <span>(T:1.34)</span> inside that skill's <td>.
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
 * Pause between steps of a "Gather history" walk. Long enough that the Stop
 * button is comfortably clickable, and it keeps the resulting page views at a
 * human pace rather than firing them back to back.
 */
const STEP_DELAY_MS = 700;

/**
 * Hard stop for the walk. The lastCode check already guarantees each step moves
 * strictly backwards, so this only exists to bound the damage if the game ever
 * starts serving a pager that loops.
 */
const MAX_MONTHS = 240;

/**
 * Reads a cell's flattened text content and parses the leading numeric value,
 * ignoring any trailing "(T:1.26)"-style training multiplier suffix and any
 * thousands-separator whitespace (e.g. "1 078" -> 1078). Using textContent
 * (rather than slicing innerHTML like viewTraining.ts's extractSkill does)
 * makes this resilient to whatever span/class markup wraps the delta/multiplier,
 * since textContent flattens all nested tags automatically.
 */
function parseCellNumber(cell: Element | undefined): number {
  const raw = (cell?.textContent || "").split("(")[0].replace(/\s/g, "");
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

/**
 * Parses every day row of the month currently rendered on the page into skill
 * history entries. Returns an empty array when the table is missing or nothing
 * parses cleanly.
 */
function parseMonthEntries(
  playerId: string,
  fallbackYear: number,
  fallbackMonth: number
): SkillHistoryEntry[] {
  const tableBody = document.getElementById("table-1")?.querySelector("tbody");
  if (!tableBody) return [];

  const capturedAt = new Date().toISOString();
  const entries: SkillHistoryEntry[] = [];

  tableBody.querySelectorAll("tr").forEach((row) => {
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

  return entries;
}

/**
 * Reads the "YYMM" part of a training-progress URL's `data` param as a number,
 * e.g. ".../treninu-progress.html?data=23817375-2606" -> 2606. Returns NaN when
 * the URL isn't shaped like one.
 */
function readMonthCode(url: string): number {
  try {
    const dataParam = new URL(url, window.location.href).searchParams.get("data");
    const yearMonth = dataParam?.split("-")[1];
    return yearMonth?.length === 4 ? parseInt(yearMonth, 10) : NaN;
  } catch {
    return NaN;
  }
}

/**
 * The YYMM code of the month currently on screen, e.g. 2608.
 *
 * Read from the pager's own year/month selects rather than from the URL: the
 * game's "Treniņu progress" tab links here as "?data=<playerId>" with no month
 * segment at all, and a month only appears in the URL once you page around with
 * "<<" / ">>". The selects are always present and always match the rendered
 * table, so they're the only reliable source for the month on screen.
 */
function readCurrentMonthCode(): number {
  const pager = document.querySelector(".select_form");
  const year = pager?.querySelector<HTMLSelectElement>("#Y")?.value;
  const month = pager?.querySelector<HTMLSelectElement>("#m")?.value;

  if (year?.length === 2 && month?.length === 2) {
    const code = parseInt(`${year}${month}`, 10);
    if (!Number.isNaN(code)) return code;
  }

  return readMonthCode(window.location.href);
}

/**
 * Reads one of the page's per-year month-bound arrays out of its inline
 * scripts, as { year: month }, e.g. { 24: 12, 25: 12, 26: 8 }.
 *
 * The page declares `mounthstart['26'] = 8; mounthend['26'] = 0;` per year and
 * uses them to build the month dropdown - `changeMounthNumbers` counts down
 * from mounthstart[y] while j > mounthend[y]. That makes them an exact record
 * of which months exist for this player, which is otherwise only discoverable
 * by walking the whole pager.
 *
 * Parsed out of script text rather than read off `window`: those are page-world
 * globals, and content scripts run in an isolated world that cannot see them.
 * Script `textContent` is plain DOM, so it is readable from here. Note the
 * quoted indices - `mounthstart['26']`, not `mounthstart[26]`.
 */
function parseMonthBounds(name: string): Record<number, number> {
  const pattern = new RegExp(
    `${name}\\s*\\[\\s*['"]?(\\d{1,2})['"]?\\s*\\]\\s*=\\s*(\\d{1,2})`,
    "g"
  );
  const bounds: Record<number, number> = {};

  document.querySelectorAll("script:not([src])").forEach((script) => {
    const text = script.textContent || "";
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      bounds[Number(match[1])] = Number(match[2]);
    }
  });

  return bounds;
}

/**
 * The YYMM code of the oldest month this player has data for - the month the
 * walk will end on. NaN when the page's bounds can't be read.
 */
function readEarliestMonthCode(): number {
  const monthEnds = parseMonthBounds("mounthend");
  const years = Object.keys(monthEnds).map(Number).sort((a, b) => a - b);
  if (years.length === 0) return NaN;

  const earliestYear = years[0];
  // mounthend is exclusive: the dropdown stops *after* it, so the first month
  // that actually exists is one later.
  const earliestMonth = monthEnds[earliestYear] + 1;
  if (earliestMonth < 1 || earliestMonth > 12) return NaN;

  return earliestYear * 100 + earliestMonth;
}

/** YYMM (e.g. 2607) as a count of months, so two codes can be subtracted. */
function toAbsoluteMonths(code: number): number {
  return Math.floor(code / 100) * 12 + (code % 100);
}

/**
 * How many months a walk starting at `fromCode` will cover, inclusive of both
 * ends. Returns 0 when either bound is unknown, so the UI falls back to
 * reporting progress without a denominator rather than showing a wrong one.
 */
function countMonthsBackTo(fromCode: number, earliestCode: number): number {
  if (Number.isNaN(fromCode) || Number.isNaN(earliestCode)) return 0;
  const span = toAbsoluteMonths(fromCode) - toAbsoluteMonths(earliestCode) + 1;
  return span > 0 ? span : 0;
}

/**
 * Finds the pager link that steps one month backwards, or null when the page is
 * showing the player's earliest month (the game simply omits the "<<" anchor
 * there - that absence is what terminates the walk).
 *
 * Matches on the target month rather than on the "<<" glyph or on DOM order, so
 * it works in every language and survives the pager being restyled. Numeric
 * comparison of the 4-digit YYMM code orders correctly across year boundaries
 * (2412 < 2501).
 */
function findPreviousMonthLink(currentCode: number): HTMLAnchorElement | null {
  if (Number.isNaN(currentCode)) return null;

  const links = document.querySelectorAll<HTMLAnchorElement>(".select_form a.page_list");
  for (const link of links) {
    const code = readMonthCode(link.href);
    if (!Number.isNaN(code) && code < currentCode) {
      return link;
    }
  }
  return null;
}

/**
 * Mirrors the look of the card's own submit button ("Mainīt") onto the mount
 * container as custom properties, so the injected button matches the control it
 * sits next to - sprite background included. Reading it at runtime beats
 * hardcoding: the game serves its stylesheets and button sprite from a
 * different subdomain, so neither cssRules nor fetch can reach the real values,
 * and a guessed hex would drift the moment PPM restyles.
 *
 * When the source button isn't on the page the component's own var() fallbacks
 * take over.
 */
function applyGameButtonStyle(container: HTMLElement): void {
  const source = document.querySelector<HTMLElement>(".select_form form button");
  if (!source) return;

  const computed = getComputedStyle(source);
  const vars: Record<string, string> = {
    "--gather-btn-color": computed.color,
    "--gather-btn-bg-color": computed.backgroundColor,
    "--gather-btn-bg-image": computed.backgroundImage,
    "--gather-btn-bg-repeat": computed.backgroundRepeat,
    "--gather-btn-bg-position": computed.backgroundPosition,
    "--gather-btn-radius": computed.borderRadius,
    "--gather-btn-padding": computed.padding,
    "--gather-btn-height": computed.height,
    "--gather-btn-font-family": computed.fontFamily,
    "--gather-btn-font-size": computed.fontSize,
    "--gather-btn-font-weight": computed.fontWeight,
  };

  Object.entries(vars).forEach(([name, value]) => {
    if (value) container.style.setProperty(name, value);
  });
}

/** The "[ Jūlijs 2026 ]" label the pager renders, without its brackets. */
function readMonthLabel(): string {
  const raw = document.querySelector(".select_form strong")?.textContent?.trim() || "";
  return raw.replace(/^\[\s*/, "").replace(/\s*\]$/, "");
}

const viewTrainingProgress = async () => {
  const searchParams = new URLSearchParams(window.location.search);
  const dataParam = searchParams.get("data") || "";
  // The month segment is optional - the game's own tab link omits it - but the
  // player id is always the first segment.
  const [playerId] = dataParam.split("-");

  if (!playerId) {
    console.warn("[TrainingProgress] Could not determine player id from URL");
    return;
  }

  // monthCode is "YYMM", e.g. 2608 -> year 2026, month 08 (August).
  const monthCode = readCurrentMonthCode();
  let fallbackYear = 0;
  let fallbackMonth = 0;
  if (!Number.isNaN(monthCode)) {
    fallbackYear = 2000 + Math.floor(monthCode / 100);
    fallbackMonth = monthCode % 100;
  }

  const entries = parseMonthEntries(playerId, fallbackYear, fallbackMonth);
  const { written } = await upsertSkillHistoryEntries(entries);
  if (written > 0) {
    const monthLabel = fallbackMonth
      ? `${fallbackYear}-${String(fallbackMonth).padStart(2, "0")}`
      : "unknown month";
    console.log(
      `[TrainingProgress] Captured ${written} skill history entries for player ${playerId} (${monthLabel})`
    );
  }

  // The pager lives in .select_form and is also where the button gets mounted,
  // so without it there is nothing to drive or to render into.
  const pager = document.querySelector(".select_form");
  if (!pager) return;

  const previousLink = findPreviousMonthLink(monthCode);
  const session = readGatherSession();
  // A session only continues while we're still walking the same player strictly
  // backwards. Anything else means the user navigated away mid-walk.
  const continuing =
    session !== null &&
    session.playerId === playerId &&
    !Number.isNaN(monthCode) &&
    monthCode < session.lastCode;

  if (session && !continuing) {
    clearGatherSession();
  }

  const monthsVisited = continuing ? session.monthsVisited + 1 : 0;
  // Fixed when the walk starts, then carried: recomputing here would count the
  // months *remaining*, since each step moves the month on screen backwards.
  const totalMonths = continuing
    ? session.totalMonths
    : countMonthsBackTo(monthCode, readEarliestMonthCode());
  // A continuing walk keeps stepping until the page stops offering a previous
  // month; that absence is what ends it.
  const stepping = continuing && previousLink !== null && monthsVisited <= MAX_MONTHS;

  // Resolved before mounting so a walk in progress never flashes the idle
  // button on the way through.
  const state = reactive({
    state: (stepping ? "gathering" : continuing ? "finished" : "idle") as
      | "idle"
      | "gathering"
      | "finished",
    monthsVisited,
    totalMonths,
    entriesWritten: continuing ? session.entriesWritten + written : 0,
    hasPrevious: previousLink !== null,
    monthLabel: readMonthLabel(),
  });

  let pendingStep: ReturnType<typeof setTimeout> | undefined;

  const stepTo = (href: string) => {
    pendingStep = setTimeout(() => {
      window.location.href = href;
    }, STEP_DELAY_MS);
  };

  const handleStart = () => {
    if (!previousLink || Number.isNaN(monthCode)) return;
    const now = Date.now();
    writeGatherSession({
      playerId,
      startedAt: now,
      updatedAt: now,
      monthsVisited: 1,
      totalMonths,
      entriesWritten: written,
      lastCode: monthCode,
    });
    state.state = "gathering";
    state.monthsVisited = 1;
    state.entriesWritten = written;
    stepTo(previousLink.href);
  };

  const handleStop = () => {
    clearTimeout(pendingStep);
    clearGatherSession();
    state.state = "finished";
  };

  const container = document.createElement("div");
  container.id = "ppm-assistant-gather";
  pager.appendChild(container);
  applyGameButtonStyle(container);
  createApp({
    render: () =>
      h(TrainingProgressGather, {
        ...state,
        onStart: handleStart,
        onStop: handleStop,
      }),
  }).mount(container);

  if (!continuing) return;

  if (!stepping) {
    // The player's earliest month - nothing left to walk to.
    clearGatherSession();
    console.log(
      `[TrainingProgress] Gather finished for player ${playerId}: ${state.monthsVisited} months, ${state.entriesWritten} entries`
    );
    return;
  }

  writeGatherSession({
    ...session,
    updatedAt: Date.now(),
    monthsVisited: state.monthsVisited,
    entriesWritten: state.entriesWritten,
    lastCode: monthCode,
  });
  stepTo(previousLink.href);
};

export default viewTrainingProgress;
