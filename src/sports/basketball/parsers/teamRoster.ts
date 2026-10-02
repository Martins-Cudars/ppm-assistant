/**
 * Parsers for the two pages the scouted data comes from: a team's "Players"
 * page (players.html / speletaji.html) and the league table (league.html /
 * liga.html). Pure - they take text the views read from the page, so the
 * checks can run them without a DOM.
 */

import { normalizePlayerId, stripThousands } from "@/base/captureUtils";

/**
 * The roster table's columns, as on the live page (2026-10-02):
 * `# Name Fun ScP Age Hgt AvQ CL Con Popularity OR`. Read by position, not by
 * header text - the headers are translated, the order isn't.
 */
export const ROSTER_COLUMNS = 11;
const COLUMN = { name: 1, age: 4, height: 5, averageQuality: 6, careerLongevity: 7, overallRating: 10 };

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
 * One roster row from its cells' text and the profile link in the name cell.
 * Null when the row isn't a player with an age and an OR - a row from some
 * other table layout must not become a snapshot.
 */
export function parseRosterRow(cells: string[], profileHref: string | undefined): RosterRow | null {
  if (cells.length !== ROSTER_COLUMNS) return null;

  const playerId = normalizePlayerId(profileHref);
  const age = cellNumber(cells[COLUMN.age]);
  const overallRating = cellNumber(cells[COLUMN.overallRating]);
  if (!playerId || age === undefined || overallRating === undefined || overallRating <= 0) {
    return null;
  }

  // "5/6" - seasons of career left out of six.
  const longevity = cells[COLUMN.careerLongevity]?.match(/(\d)\s*\/\s*6/)?.[1];

  return {
    playerId,
    name: cells[COLUMN.name].trim(),
    age,
    height: cellNumber(cells[COLUMN.height]),
    averageQuality: cellNumber(cells[COLUMN.averageQuality]),
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
