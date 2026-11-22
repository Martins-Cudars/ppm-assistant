/**
 * Relative skill: the player's best-position rating with XP as a percentage of
 * a top player's at the same age. Two 100% lines per sport: the 95th
 * percentile of every scouted player ("global", static,
 * src/sports/<sport>/relativeSkillReference.ts) and of the viewer's league
 * ("league", fitted at runtime, src/base/scout/leagueRelativeSkill.ts).
 * Shown as "82% / 94%", global first. A value that can't be worked out shows
 * "???" without a rank colour, and the tooltip says why: "82% / ???" without
 * a league line, "??? / ???" outside the table's ages or for an unscouted
 * player.
 */

/** The 100% values at a player's exact age; null where there is none. */
export type RelativeSkillMaxima = {
  global: number | null;
  league: number | null;
  /** An unscouted player: no skills, so no relative skill at all. */
  skillsUnknown?: boolean;
};

/** A whole percentage, or null when there is no reference for the age. */
export function relativePercent(skill: number, maxSkillForAge: number | null | undefined): number | null {
  return maxSkillForAge ? Math.round((skill / maxSkillForAge) * 100) : null;
}

/** The colour class, in steps of 5 (styles.css has 0-100; above 100 keeps the 100 colour). */
export function relativeSkillClass(percent: number): string {
  return `relative-skill--${Math.min(100, Math.max(0, Math.floor(percent / 5) * 5))}`;
}

/**
 * Whether the page has the viewer's league line, and if not, why. Worked out
 * by the background worker (src/storage/leagueReferenceFit.ts) except
 * "loading", which the page holds until the answer arrives.
 */
export type LeagueLineStatus =
  | { kind: "fitted" }
  | { kind: "loading" }
  | { kind: "no-league" }
  | { kind: "stale"; listSeason: number; currentSeason: number }
  | { kind: "sparse"; points: number; pointsNeeded: number; ages: number; agesNeeded: number }
  | { kind: "error" };

/** Why the league value is missing, for the tooltip. */
export function leagueMissingReason(status: LeagueLineStatus, age: number): string {
  switch (status.kind) {
    case "fitted":
      return `League: no reference for age ${age}`;
    case "loading":
      return "League: still loading";
    case "no-league":
      return "League: no league list stored; open your league page to read it";
    case "stale":
      return `League: league list is from season ${status.listSeason}; open your league page to refresh it`;
    case "sparse":
      return status.points < status.pointsNeeded
        ? `League: not enough scouted players from your league this season (${status.points} found, ${status.pointsNeeded} needed)`
        : `League: scouted players from your league this season cover too few ages (${status.ages} found, ${status.agesNeeded} needed)`;
    case "error":
      return "League: could not be read";
  }
}

/** One relative-skill cell: each value or null for "???", and the tooltip. */
export type RelativeSkillView = { global: number | null; league: number | null; title: string };

/**
 * What a relative-skill cell shows: "82% / 94%", "82% / ???" or "??? / ???".
 * The league value is only shown with a global one. The tooltip says what
 * each value is, or why it is missing.
 */
export function relativeSkillView(
  skill: number,
  maxima: RelativeSkillMaxima,
  age: number,
  leagueStatus: LeagueLineStatus
): RelativeSkillView {
  const global = relativePercent(skill, maxima.global);
  const league = global === null ? null : relativePercent(skill, maxima.league);
  const lines = maxima.skillsUnknown
    ? ["Unscouted player: skills unknown"]
    : global === null
      ? [`No reference for age ${age}`]
      : [
          `Relative skill for age: ${global}% of a top-5% player among all scouted teams`,
          league === null
            ? leagueMissingReason(leagueStatus, age)
            : `${league}% of a top-5% player in your league`,
        ];
  return { global, league, title: lines.join("\n") };
}

/**
 * A list column's sort value: by global, then league ("???" as 0). Null -
 * sorted last in either direction by SortableTable - when the global value is
 * "???".
 */
export function relativeSortValue(skill: number, maxima: RelativeSkillMaxima): number | null {
  const global = relativePercent(skill, maxima.global);
  if (global === null) return null;
  return global * 1000 + (relativePercent(skill, maxima.league) ?? 0);
}
