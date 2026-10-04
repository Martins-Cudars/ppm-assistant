/**
 * Skill gains over a stretch of history, leaving out days that aren't normal
 * training. Shared by every sport's growth model: the rules are the game's,
 * not the sport's, and were measured on both (see docs/skill-history.md).
 */

/** An entry that carries skills, for any sport's skill set. */
export type SkilledEntry<K extends string> = {
  date: string;
  skills: Record<K, number>;
  /** Where the day was captured - tells whole-number captures from decimal ones. */
  source?: string;
};

/**
 * Sources that store skills as whole numbers: the squad overview and the
 * profile show integers, where the training-progress page has two decimals.
 * Entries without a source are older training-progress days - decimal.
 */
const WHOLE_NUMBER_SOURCES = new Set(["PlayersList", "PlayerProfile"]);

/**
 * Whether an entry is a whole-number capture, whose day-to-day changes can't
 * be judged: a normal training day of +0.7 usually shows as no change at all.
 *
 * Judged by the source, not by "has no decimals" alone - a decimal history
 * passes through whole numbers too (410 / 205 / 205 is a normal day), and its
 * flat days are real. The integer check covers a capture that kept its
 * decimals through a same-day merge (src/storage/historyMerge.ts).
 */
export function isWholeNumberCapture<K extends string>(entry: SkilledEntry<K>): boolean {
  return (
    entry.source !== undefined &&
    WHOLE_NUMBER_SOURCES.has(entry.source) &&
    Object.values<number>(entry.skills).every((value) => Number.isInteger(value))
  );
}

/**
 * A training camp: this many consecutive days, each gaining more than
 * CAMP_GAIN_RATIO x the window's median daily gain. Camps roughly double
 * training - 1.98x in hockey, 2.0x in basketball - and show as runs of 4-14
 * days on the same dates across the youth squad. Ordinary good days come in
 * runs of 1-3.
 */
export const CAMP_MIN_RUN_DAYS = 4;
export const CAMP_GAIN_RATIO = 1.6;

/**
 * Above this share of no-training days the player isn't being trained at all
 * (too old, or no training set), so skipping them would measure a handful of
 * leftover days. The pace then keeps them and honestly reads low.
 */
export const NOT_TRAINING_SHARE = 0.5;

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000
  );
}

export interface CleanedGains<K extends string> {
  /** Per-skill gains over the kept intervals. */
  gains: Record<K, number>;
  /** Days covered by the kept intervals. */
  measuredDays: number;
  /**
   * Judgeable one-day intervals kept - the part measured day by day from
   * decimal entries, not endpoint to endpoint. Whole-number days don't count.
   */
  measuredDailyDays: number;
  skippedNoTrainingDays: number;
  skippedCampDays: number;
}

type Interval<K extends string> = {
  days: number;
  gains: Record<K, number>;
  total: number;
  /** A 1-day step between two decimal entries - the only kind that can be judged. */
  judgeable: boolean;
};

export interface CleaningOptions {
  /**
   * Judge camp days against normal days of the SAME trained skill (the one
   * that gained most that day) rather than against all days. For sports that
   * train one skill a day: in basketball one player gained 0.74 a day on
   * speed but 1.13 on passing, so a speed day at camp (1.68) sat below 1.6x
   * the overall median and broke the camp run in two.
   */
  perSkillCampBaseline?: boolean;
}

/** Normal days needed for a skill to get its own camp baseline; fewer fall back to all days. */
const PER_SKILL_MIN_DAYS = 3;

/**
 * Per-skill gains over a window, leaving out days that aren't normal training.
 *
 * PPM has no rest days: a player gains nothing only when injured, too old, or
 * with no training selected. So a day where every skill stands still is
 * skipped - even a single one, since injuries can be that short. Crucially it
 * is ALL skills, not a position's main skills: in hockey 23% of days left the
 * main skills flat, but on 87% of those another skill grew (training simply
 * went elsewhere that day) - real training that must count.
 *
 * Training camps (about double training for 7-14 days) are skipped too, so the
 * pace describes normal training rather than whichever event a window caught.
 *
 * Only 1-day intervals between two decimal entries can be judged. Everything
 * else is always kept and so measured endpoint to endpoint:
 *
 * - longer intervals - gaps, or history from occasional profile visits;
 * - days touching a whole-number capture (isWholeNumberCapture). Squad-overview
 *   and profile days store integers, so most normal training days show no
 *   change. Skipping those as "no training" while still counting the gain when
 *   the number ticked up read a pace ~1.8x too high (0.7 points a day over 7
 *   skills: 25 of 56 days looked flat). Kept, the average rate is right; a
 *   window ending on a whole-number day only loses the fraction at its end
 *   (under a point per trained skill), reading slightly low.
 */
export function cleanedGains<K extends string>(
  window: SkilledEntry<K>[],
  skillNames: readonly K[],
  spanDays: number,
  options: CleaningOptions = {}
): CleanedGains<K> {
  const intervals: Interval<K>[] = [];
  for (let i = 1; i < window.length; i++) {
    const gains = Object.fromEntries(
      skillNames.map((skill) => [
        skill,
        (window[i].skills[skill] ?? 0) - (window[i - 1].skills[skill] ?? 0),
      ])
    ) as Record<K, number>;
    const days = daysBetween(window[i - 1].date, window[i].date);
    intervals.push({
      days,
      gains,
      total: skillNames.reduce((sum, skill) => sum + gains[skill], 0),
      judgeable:
        days === 1 && !isWholeNumberCapture(window[i - 1]) && !isWholeNumberCapture(window[i]),
    });
  }

  // "Daily" below always means judgeable: a 1-day step between decimal entries.
  const isDaily = (interval: Interval<K>) => interval.judgeable;
  const isFlat = (interval: Interval<K>) => isDaily(interval) && Math.abs(interval.total) < 0.01;

  const skip = new Set<Interval<K>>();

  // Mostly flat means not being trained at all - keep those days, so the
  // pace reads low rather than measuring whatever few days are left.
  const flatDays = intervals.filter(isFlat).length;
  if (flatDays <= NOT_TRAINING_SHARE * spanDays) {
    intervals.filter(isFlat).forEach((interval) => skip.add(interval));
  }

  // Camps: runs of consecutive days well above this window's normal day.
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const trainedSkill = (interval: Interval<K>) =>
    skillNames.reduce((top, skill) => (interval.gains[skill] > interval.gains[top] ? skill : top));
  const normal = intervals.filter((interval) => isDaily(interval) && !isFlat(interval));
  let skippedCampDays = 0;
  if (normal.length > 0) {
    const overall = median(normal.map((interval) => interval.total));
    const bySkill = new Map<K, number>();
    if (options.perSkillCampBaseline) {
      skillNames.forEach((skill) => {
        const days = normal.filter((interval) => trainedSkill(interval) === skill);
        if (days.length >= PER_SKILL_MIN_DAYS) bySkill.set(skill, median(days.map((d) => d.total)));
      });
    }
    // Each skill's median includes its camp days too, which pulls it up - but
    // camps are at most ~10 of 56 days, so the median stays a normal day.
    const threshold = (interval: Interval<K>) =>
      CAMP_GAIN_RATIO * (bySkill.get(trainedSkill(interval)) ?? overall);
    let run: Interval<K>[] = [];
    const closeRun = () => {
      if (run.length >= CAMP_MIN_RUN_DAYS) {
        run.forEach((interval) => skip.add(interval));
        skippedCampDays += run.length;
      }
      run = [];
    };
    for (const interval of intervals) {
      if (isDaily(interval) && interval.total > threshold(interval)) run.push(interval);
      else closeRun();
    }
    closeRun();
  }

  const gains = Object.fromEntries(skillNames.map((skill) => [skill, 0])) as Record<K, number>;
  let measuredDays = 0;
  let measuredDailyDays = 0;
  for (const interval of intervals) {
    if (skip.has(interval)) continue;
    measuredDays += interval.days;
    if (isDaily(interval)) measuredDailyDays++;
    skillNames.forEach((skill) => (gains[skill] += interval.gains[skill]));
  }

  return {
    gains,
    measuredDays,
    measuredDailyDays,
    skippedNoTrainingDays: flatDays <= NOT_TRAINING_SHARE * spanDays ? flatDays : 0,
    skippedCampDays,
  };
}
