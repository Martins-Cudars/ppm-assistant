/**
 * Relative skill: the player's best-position rating with XP as a percentage of
 * a top player's at the same age. Two 100% lines per sport
 * (src/sports/<sport>/relativeSkillReference.ts): the 95th percentile of every
 * scouted player ("global") and of the user's league ("league"). Shown as
 * "82% / 94%", global first.
 */

export type RelativeSkillPair = {
  global: number;
  league: number;
};

/** A whole percentage, or 0 when there is no reference for the age. */
export function relativePercent(skill: number, maxSkillForAge: number): number {
  return maxSkillForAge ? Math.round((skill / maxSkillForAge) * 100) : 0;
}

/** The colour class, in steps of 5 (styles.css has 0-100; above 100 keeps the 100 colour). */
export function relativeSkillClass(percent: number): string {
  return `relative-skill--${Math.min(100, Math.max(0, Math.floor(percent / 5) * 5))}`;
}

export function relativeSkillTitle(pair: RelativeSkillPair): string {
  return (
    `Relative skill for age: ${pair.global}% of a top-5% player among all scouted teams` +
    ` / ${pair.league}% of a top-5% player in your league`
  );
}
