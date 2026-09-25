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

export interface Neighbour extends RankedPlayer {
  rank: number;
  /** Neighbour's rating minus the subject's: positive above, zero or negative below. */
  gap: number;
}

export interface SquadRank {
  position: string;
  /** 1-based. Ties share the better rank. */
  rank: number;
  /** Players at this position, the subject included. */
  total: number;
  /** The closest player rated strictly higher, or null at rank 1. */
  above: Neighbour | null;
  /** The closest player rated the same or lower, or null in last place. */
  below: Neighbour | null;
}

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
export function rankInSquad(subject: RankedPlayer, squad: RankedPlayer[]): SquadRank {
  const others = squad
    .filter((player) => player.id !== subject.id && player.position === subject.position)
    .sort((a, b) => b.rating - a.rating);

  const higher = others.filter((player) => player.rating > subject.rating);
  const rest = others.filter((player) => player.rating <= subject.rating);
  const rank = higher.length + 1;

  const closestAbove = higher[higher.length - 1];
  const closestBelow = rest[0];

  return {
    position: subject.position,
    rank,
    total: others.length + 1,
    above: closestAbove
      ? {
          ...closestAbove,
          // Rank among the others; ties above share, just like the subject's.
          rank: 1 + others.filter((player) => player.rating > closestAbove.rating).length,
          gap: closestAbove.rating - subject.rating,
        }
      : null,
    below: closestBelow
      ? {
          ...closestBelow,
          // Everyone above the subject, plus the subject, sits above it -
          // unless it ties the subject, in which case it shares their rank.
          rank: closestBelow.rating === subject.rating ? rank : rank + 1,
          gap: closestBelow.rating - subject.rating,
        }
      : null,
  };
}
