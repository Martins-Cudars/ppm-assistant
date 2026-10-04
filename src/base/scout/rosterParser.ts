/**
 * Parsers for the two pages the scouted data comes from, in every sport: a
 * team's "Players" page (players.html / speletaji.html) and the league table
 * (league.html / liga.html). Pure - they take text the views read from the
 * page, so the checks can run them without a DOM.
 */

import { normalizePlayerId, stripThousands } from "@/base/captureUtils";

/**
 * Where a sport's roster table keeps each value, by column position - the
 * headers are translated, the order isn't. Read from the live pages:
 * - basketball (2026-10-02): `# Name Fun ScP Age Hgt AvQ CL Con Popularity OR`
 * - hockey (2026-10-04): `# Name Fun ScP Age AvQ CL Con Pop OR` - no height
 * - soccer (2026-10-04): `# Name Fun ScP Age AvQ CL Con Popularity OR` - as hockey
 * The user's own Players page has the same layout (Ene in place of Con).
 */
export interface RosterLayout {
  columns: number;
  name: number;
  age: number;
  height?: number;
  averageQuality: number;
  careerLongevity: number;
  overallRating: number;
}

export const BASKETBALL_ROSTER: RosterLayout = {
  columns: 11,
  name: 1,
  age: 4,
  height: 5,
  averageQuality: 6,
  careerLongevity: 7,
  overallRating: 10,
};

export const HOCKEY_ROSTER: RosterLayout = {
  columns: 10,
  name: 1,
  age: 4,
  averageQuality: 5,
  careerLongevity: 6,
  overallRating: 9,
};

/** Soccer's roster has hockey's columns (read from the page text; scripts can't run there). */
export const SOCCER_ROSTER: RosterLayout = HOCKEY_ROSTER;

export interface RosterRow {
  playerId: string;
  name: string;
  age: number;
  height?: number;
  averageQuality?: number;
  careerLongevity?: number;
  overallRating: number;
}

/** A whole number from a cell ("1,024", "1 024", " 19 "), or undefined when there's none. */
function cellNumber(text: string | undefined): number | undefined {
  const cleaned = stripThousands((text ?? "").replace(/\s/g, ""));
  return /^\d+$/.test(cleaned) ? parseInt(cleaned, 10) : undefined;
}

/**
 * The player's profile link among a name cell's links: the one whose `data=`
 * is a player id. The country flag links there too ("country-profile.html?data=lva").
 */
export function profileHrefOf(hrefs: (string | null | undefined)[]): string | undefined {
  return (
    hrefs.find(
      (href): href is string =>
        !!href && !/country/i.test(href) && /[?&]data=\d+/.test(href)
    ) ?? undefined
  );
}

/**
 * One roster row from its cells' text and the profile link in the name cell.
 * Null when the row isn't a player with an age and an OR - a row from some
 * other table layout must not become a snapshot.
 */
export function parseRosterRow(
  cells: string[],
  profileHref: string | undefined,
  layout: RosterLayout
): RosterRow | null {
  if (cells.length !== layout.columns) return null;

  const playerId = normalizePlayerId(profileHref);
  const age = cellNumber(cells[layout.age]);
  const overallRating = cellNumber(cells[layout.overallRating]);
  if (!playerId || age === undefined || overallRating === undefined || overallRating <= 0) {
    return null;
  }

  // "5/6" - seasons of career left out of six.
  const longevity = cells[layout.careerLongevity]?.match(/(\d)\s*\/\s*6/)?.[1];

  return {
    playerId,
    name: cells[layout.name].trim(),
    age,
    height: layout.height !== undefined ? cellNumber(cells[layout.height]) : undefined,
    averageQuality: cellNumber(cells[layout.averageQuality]),
    careerLongevity: longevity !== undefined ? parseInt(longevity, 10) : undefined,
    overallRating,
  };
}

/** The team id from a team link or a page URL's `data=` ("42029-jelgava-slashing"). */
export function teamIdFromHref(href: string | null | undefined): string | null {
  return href?.match(/[?&]data=(\d+)/)?.[1] ?? null;
}

/**
 * Which league a league page shows, from its season / country / level /
 * number selectors (their values and the country's visible name). Null when
 * any is missing - without them one "III.3" can't be told from another
 * country's.
 */
export function parseLeagueIdentity(selects: {
  season?: string;
  country?: string;
  countryName?: string;
  level?: string;
  number?: string;
}): { season: number; leagueId: string; leagueName: string } | null {
  const { season, country, level, number } = selects;
  if (!season || !country || !level || !number || !/^\d+$/.test(season)) return null;
  return {
    season: parseInt(season, 10),
    leagueId: `${country}-${level}-${number}`.toLowerCase(),
    leagueName: `${level.toUpperCase()}.${number} (${selects.countryName?.trim() || country.toUpperCase()})`,
  };
}
