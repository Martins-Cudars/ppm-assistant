/**
 * Where a player would rank at their position within the logged-in team's
 * squad - "the 5th best winger on the team".
 *
 * Pure functions over plain records, so the profile card and the checks in
 * test/squad-rank.check.ts share one implementation.
 */

/** One player as the ranking sees them. */
export interface RankedPlayer {
  id: string;
  name: string;
  /** Best position, e.g. "W". */
  position: string;
  /** That position's rating with XP - the big number on the position card. */
  rating: number;
}

export interface StandingRow extends RankedPlayer {
  /** 1-based. Ties share the better rank. */
  rank: number;
  /** This row's rating minus the subject's: positive above, zero or negative below. */
  gap: number;
  /** Where the row sits relative to the subject's row. */
  side: "above" | "subject" | "below";
}

export interface SquadRank {
  position: string;
  /** The subject's rank, 1-based. Ties share the better rank. */
  rank: number;
  /** Players at this position, the subject included. */
  total: number;
  /**
   * A slice of the standings around the subject, the subject's row included,
   * best first. Holds up to `neighbours` other players, split evenly above and
   * below and shifted to one side at the top or bottom of the table.
   */
  rows: StandingRow[];
}

/** How many other players the standings slice shows by default. */
export const DEFAULT_NEIGHBOURS = 4;

export const POSITION_NOUN: Record<string, string> = {
  G: "goalie",
  D: "defender",
  W: "winger",
  C: "centre",
};

/** 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th ... 21st. */
export function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;

  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * The subject's rank among squad players sharing their best position.
 *
 * The subject is always ranked from the record passed in - the live profile -
 * and any copy of them in `squad` is dropped by id. The cached copy can be days
 * old, and counting both would rank a player against themselves.
 *
 * Whether the subject is actually on the team doesn't change the arithmetic:
 * an own player "is" the Nth best, anyone else "would be" - the caller words it.
 */
export function rankInSquad(
  subject: RankedPlayer,
  squad: RankedPlayer[],
  neighbours: number = DEFAULT_NEIGHBOURS
): SquadRank {
  const others = squad.filter(
    (player) => player.id !== subject.id && player.position === subject.position
  );

  // Best first. Among equal ratings the subject is listed first: they share
  // the rank, and "5th" should sit next to the rows it's compared against.
  const table = [subject, ...others].sort(
    (a, b) => b.rating - a.rating || Number(b === subject) - Number(a === subject)
  );
  const rankOf = (rating: number) => 1 + table.filter((player) => player.rating > rating).length;

  const index = table.indexOf(subject);
  const size = Math.min(table.length, neighbours + 1);
  const start = Math.min(
    Math.max(0, index - Math.floor(neighbours / 2)),
    table.length - size
  );

  return {
    position: subject.position,
    rank: rankOf(subject.rating),
    total: table.length,
    rows: table.slice(start, start + size).map((player, offset) => ({
      ...player,
      rank: rankOf(player.rating),
      gap: player.rating - subject.rating,
      side:
        player === subject ? "subject" : start + offset < index ? "above" : "below",
    })),
  };
}
