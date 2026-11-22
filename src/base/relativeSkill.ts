/**
 * Relative skill: the player's best-position rating with XP as a percentage of
 * a top player's at the same age. Two 100% lines per sport: the 95th
 * percentile of every scouted player ("global", static,
 * src/sports/<sport>/relativeSkillReference.ts) and of the viewer's league
 * ("league", fitted at runtime, src/base/scout/leagueRelativeSkill.ts).
 * Shown as "82% / 94%", global first; "–" outside the table's ages.
 */

/** The 100% values at a player's exact age; null where there is none. */
export type RelativeSkillMaxima = {
  global: number | null;
  league: number | null;
};

/** A whole percentage, or null when there is no reference for the age. */
export function relativePercent(skill: number, maxSkillForAge: number | null | undefined): number | null {
  return maxSkillForAge ? Math.round((skill / maxSkillForAge) * 100) : null;
}

/** The colour class, in steps of 5 (styles.css has 0-100; above 100 keeps the 100 colour). */
export function relativeSkillClass(percent: number): string {
  return `relative-skill--${Math.min(100, Math.max(0, Math.floor(percent / 5) * 5))}`;
}

export function relativeSkillTitle(global: number, league: number): string {
  return (
    `Relative skill for age: ${global}% of a top-5% player among all scouted teams` +
    ` / ${league}% of a top-5% player in your league`
  );
}

/**
 * A list column's sort value: by global, then league. Null - sorted last in
 * either direction by SortableTable - when the age has no reference.
 */
export function relativeSortValue(skill: number, maxima: RelativeSkillMaxima): number | null {
  const global = relativePercent(skill, maxima.global);
  if (global === null) return null;
  return global * 1000 + (relativePercent(skill, maxima.league) ?? 0);
}
