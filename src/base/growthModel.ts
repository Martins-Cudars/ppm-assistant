/**
 * The growth model shared by hockey and soccer: how fast a player is being
 * trained, measured against a top-player curve, and where that pace lands
 * them if it holds. Each sport passes a GrowthConfig - its skills, positions,
 * top-player table and the constants measured on the user's own team - and
 * gets back the functions bound to it (createGrowthModel).
 *
 * Pure functions only - no DOM, no chrome API - so the same numbers back the
 * Player Report's Pace / @25 / Potential columns and the profile chart.
 *
 * Pace is measured in skill points, not in rating movement. A position's base
 * rating is min(skill / weight) over its main skills, so it only moves when
 * the bottleneck skill does:
 *
 * - A young player catching up their bottleneck turns ~1 skill point into ~1
 *   rating point, where balanced training costs Σweights. Measured by rating, a
 *   hockey 15-year-old training only defence read 97% when the honest figure
 *   was ~57%.
 * - Points going into a skill that isn't the bottleneck don't move the rating
 *   at all, so a player being trained hard could read as 0%.
 *
 * Counting the points put into the position's main skills avoids both. The
 * per-sport findings behind each constant are in docs/skill-history.md.
 */

import { calculatePositions } from "@/classes/playerCalculations";
import { calculateSkillWithExp } from "@/base/calculations";
import { CleaningOptions, cleanedGains, daysBetween } from "@/base/gainCleaning";
import { SkillHistoryEntry } from "@/types/SkillHistory";

type Skills = Record<string, number>;

/** A position as the growth model needs it: main skills with weights, optional bonus skills. */
export interface GrowthPosition {
  name: string;
  /** Skill -> weight. `object` so each sport's own settings interface fits; read with Object.entries. */
  ratios: object;
  bonus?: object;
}

export interface GrowthConfig<TSkills extends Skills> {
  skillNames: readonly (keyof TSkills & string)[];
  positionSettings: readonly GrowthPosition[];
  /** The bonus is capped at this share of the base rating (hockey 0.6, soccer 0.35). */
  bonusCapRatio: number;
  daysPerSeason: number;
  /** The top-player table: skill (position rating with bonus, no XP) and XP by whole age. */
  growthTable: readonly { age: number; skill: number; exp: number }[];
  /**
   * Replaces the table's slope (skill[age+1] - skill[age]) at these whole ages
   * - for a table whose growth shape the user's own players don't follow
   * (soccer's after 23).
   */
  referenceSlopeOverrides?: Readonly<Record<number, number>>;
  /** How fast players train at each age relative to the reference ages, at the user's team. */
  agePaceFactors: readonly { fromAge: number; factor: number }[];
  pace: {
    /** How far back from the latest usable entry the pace is measured. */
    windowDays: number;
    /** Measured days for a full (not provisional) pace. */
    minSpanDays: number;
    /** Measured days for a provisional pace. */
    provisionalMinDays: number;
  };
  camps: {
    maxDaysPerSeason: number;
    /** What a camp day adds on top of a normal day (2x training -> 1.0). */
    dayExtra: number;
    untilAge: number;
    /** How far back a player's own camp record is read. */
    lookbackDays: number;
  };
  /** Typical XP as a share of the table's `exp`, by age - a floor for projected XP. */
  xpShares: readonly { fromAge: number; share: number }[];
  /** Projections stop here: the curve turns to decline, and pace against it stops meaning anything. */
  projectionMaxAge: number;
  /** Where "potential" is projected to - roughly where skill with XP peaks. */
  potentialAge: number;
  /** How no-training and camp days are told apart (see src/base/gainCleaning.ts). */
  cleaning?: CleaningOptions;
}

export interface GrowthPace<TSkills extends Skills = Skills> {
  /** The position whose main skills were counted, e.g. "D". */
  position: string;
  /** Skill points per season put into the position's main skills. */
  pointsPerSeason: number;
  /** The base rating per season those points buy under balanced training: points / Σweights. */
  basePerSeason: number;
  /**
   * How fast the position's bonus grows: while capped it rises with the base;
   * otherwise it's the bonus skills' points per season times their weights.
   */
  bonusPerSeason: number;
  /** Base plus bonus per season - what `pace` compares against the curve. */
  gainPerSeason: number;
  /**
   * How fast the position's base rating actually moved. Differs from
   * basePerSeason while a bottleneck is being caught up. Context only.
   */
  ratingMovedPerSeason: number;
  /** Points per season for every skill, for projecting the non-main ones. */
  skillRates: Record<keyof TSkills & string, number>;
  /** The reference gain per season at the window's midpoint age, or null where there is none. */
  expectedPerSeason: number | null;
  /** gainPerSeason / expectedPerSeason, e.g. 0.66 for 66%. */
  pace: number | null;
  /** basePerSeason / expectedPerSeason - what projections and age factors use. */
  basePace: number | null;
  /** The player's age at the middle of the window. */
  midAge: number;
  fromDate: string;
  toDate: string;
  /** Calendar days from fromDate to toDate. */
  spanDays: number;
  /** Days the rates were measured over: spanDays minus the skipped days. */
  measuredDays: number;
  /** Days with no training at all (injured, or none selected), left out. */
  skippedNoTrainingDays: number;
  /** Training-camp days, left out. */
  skippedCampDays: number;
  /** Fewer than the full minimum of measured days: shown, but marked. */
  provisional: boolean;
  /** Camp days a season the projection assumes until the camp age limit. */
  campDaysPerSeason: number;
  /** True when there isn't a season of history, so the full allowance is assumed. */
  campDaysAssumed: boolean;
}

export interface Potential {
  /** Position rating with bonus, no XP, at the potential age (or now, if past it). */
  rating: number;
  /** XP at the potential age (or now). */
  xp: number;
  /** Rating with XP - what the stars show. */
  ratingWithXp: number;
  /** "current" for players at or past the potential age: they're at their peak already. */
  kind: "projected" | "current";
}

export function createGrowthModel<TSkills extends Skills>(config: GrowthConfig<TSkills>) {
  type SkillName = keyof TSkills & string;
  type Entry = SkillHistoryEntry<TSkills>;
  type SkilledEntry = Entry & { skills: TSkills };

  const SKILL_NAMES = config.skillNames as readonly SkillName[];
  const table = config.growthTable;

  /** The age factor for an exact age. */
  function agePaceFactor(age: number): number {
    let factor = config.agePaceFactors[0].factor;
    for (const band of config.agePaceFactors) {
      if (age >= band.fromAge) factor = band.factor;
    }
    return factor;
  }

  /** Age on an entry's date, counting a season as daysPerSeason calendar days. */
  function historyEntryAge(entry: { date: string }, currentExactAge: number): number {
    const daysAgo = (Date.now() - Date.parse(`${entry.date}T00:00:00`)) / 86_400_000;
    return currentExactAge - daysAgo / config.daysPerSeason;
  }

  /** A position's main skills and their weights, e.g. D: defence 1, passing 0.5, aggression 0.5. */
  function mainWeights(positionName: string): [SkillName, number][] | null {
    const rule = config.positionSettings.find((p) => p.name === positionName);
    if (!rule) return null;
    return (Object.entries(rule.ratios) as [SkillName, number | undefined][]).filter(
      (pair): pair is [SkillName, number] => typeof pair[1] === "number" && pair[1] > 0
    );
  }

  /** A position's bonus skills and their weights, e.g. W: shooting 0.45. */
  function bonusWeights(positionName: string): [SkillName, number][] {
    const rule = config.positionSettings.find((p) => p.name === positionName);
    return (Object.entries(rule?.bonus ?? {}) as [SkillName, number | undefined][]).filter(
      (pair): pair is [SkillName, number] => typeof pair[1] === "number" && pair[1] > 0
    );
  }

  /** The position's base rating, unrounded - the bottleneck skill over its weight. */
  function positionBase(skills: TSkills, weights: [SkillName, number][]): number {
    return Math.min(...weights.map(([skill, weight]) => (skills[skill] ?? 0) / weight));
  }

  const positionsOf = (skills: TSkills) =>
    calculatePositions(
      skills,
      config.positionSettings as unknown as Parameters<typeof calculatePositions>[1],
      0,
      config.bonusCapRatio
    );

  /** The position's rating with bonus, through the same formula the game columns use. */
  function positionRating(skills: TSkills, positionName: string): number | null {
    const position = positionsOf(skills).find((p) => p.name === positionName);
    return position ? position.ratingWithBonus : null;
  }

  /**
   * The reference base-rating gain per season at an exact age: the table's
   * slope skill[floor(age) + 1] - skill[floor(age)] (constant within each year,
   * so a 100% pace projects onto the drawn curve exactly), unless the config
   * overrides that age. Null outside the table, from the projection max age
   * on, or where the gain isn't positive.
   */
  function expectedSeasonGain(age: number): number | null {
    if (!Number.isFinite(age) || age >= config.projectionMaxAge) return null;

    const whole = Math.floor(age);
    const override = config.referenceSlopeOverrides?.[whole];
    if (override !== undefined) return override > 0 ? override : null;

    const from = table.find((p) => p.age === whole);
    const to = table.find((p) => p.age === whole + 1);
    if (!from || !to) return null;

    const gain = to.skill - from.skill;
    return gain > 0 ? gain : null;
  }

  /** How much the reference rises between two ages, year by year, stopping at the max age. */
  function curveGainBetween(fromAge: number, toAge: number): number {
    const endAge = Math.min(toAge, config.projectionMaxAge);
    let total = 0;
    let age = fromAge;

    while (age < endAge) {
      const segmentEnd = Math.min(Math.floor(age) + 1, endAge);
      const gain = expectedSeasonGain(age);
      if (gain === null) break;

      total += gain * (segmentEnd - age);
      age = segmentEnd;
    }

    return total;
  }

  /**
   * The reference's rise between two ages, each year weighted by its age
   * factor, and - before the camp age limit - by the camp allowance: each camp
   * day a season adds dayExtra of a normal day to the season. Factor bands and
   * the camp limit start on whole ages, and the walk steps through whole ages,
   * so no segment straddles a boundary.
   */
  function adjustedCurveGainBetween(fromAge: number, toAge: number, campDaysPerSeason = 0): number {
    const campBoost = 1 + (campDaysPerSeason * config.camps.dayExtra) / config.daysPerSeason;
    const endAge = Math.min(toAge, config.projectionMaxAge);
    let total = 0;
    let age = fromAge;

    while (age < endAge) {
      const segmentEnd = Math.min(Math.floor(age) + 1, endAge);
      const gain = expectedSeasonGain(age);
      if (gain === null) break;

      const camps = age < config.camps.untilAge ? campBoost : 1;
      total += gain * agePaceFactor(age) * camps * (segmentEnd - age);
      age = segmentEnd;
    }

    return total;
  }

  /**
   * The player's recent growth pace for a position, or null without enough
   * history to measure one honestly. The window ends at the latest entry with
   * skills - not at today - so callers should show `toDate`. Entries without
   * skills (an unscouted opponent's profile) are ignored rather than read as
   * zero.
   */
  function measureGrowthPace(
    entries: Entry[],
    currentExactAge: number,
    positionName: string
  ): GrowthPace<TSkills> | null {
    const weights = mainWeights(positionName);
    if (!weights || weights.length === 0) return null;

    const usable = entries
      .filter((entry): entry is SkilledEntry => !!entry.skills)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (usable.length < 2) return null;

    const last = usable[usable.length - 1];
    const first = usable.find((entry) => daysBetween(entry.date, last.date) <= config.pace.windowDays);
    if (!first || first === last) return null;

    const spanDays = daysBetween(first.date, last.date);
    const cleaned = cleanedGains(usable.slice(usable.indexOf(first)), SKILL_NAMES, spanDays, config.cleaning);
    if (cleaned.measuredDays < config.pace.provisionalMinDays) return null;

    // The camp record reads a full season, not just the pace window - camps
    // come once or twice a season, so the window can easily miss one. Without
    // a season of history, assume the full allowance until the player's own
    // record exists.
    const seasonStart = usable.find(
      (entry) => daysBetween(entry.date, last.date) <= config.camps.lookbackDays
    )!;
    const seasonSpan = daysBetween(seasonStart.date, last.date);
    const campDaysAssumed = daysBetween(usable[0].date, last.date) < config.camps.lookbackDays;
    const campDaysPerSeason = campDaysAssumed
      ? config.camps.maxDaysPerSeason
      : Math.min(
          config.camps.maxDaysPerSeason,
          cleanedGains(usable.slice(usable.indexOf(seasonStart)), SKILL_NAMES, seasonSpan, config.cleaning)
            .skippedCampDays
        );

    const perSeason = (value: number) => (value / cleaned.measuredDays) * config.daysPerSeason;

    const skillRates = Object.fromEntries(
      SKILL_NAMES.map((skill) => [skill, perSeason(cleaned.gains[skill])])
    ) as Record<SkillName, number>;

    const pointsPerSeason = weights.reduce((sum, [skill]) => sum + skillRates[skill], 0);
    const weightSum = weights.reduce((sum, [, weight]) => sum + weight, 0);
    const basePerSeason = pointsPerSeason / weightSum;

    // The bonus counts too: the curve's `skill` is the position rating WITH
    // bonus, so a base-only pace understates every position whose bonus
    // skills are trained. Measured from skill rates, not from how the capped
    // bonus moved: while the bonus sits at its cap it can only rise with the
    // base, whatever the bonus skills do.
    const bonus = bonusWeights(positionName);
    const lastBase = positionBase(last.skills, weights);
    const rawBonus = bonus.reduce((sum, [skill, weight]) => sum + (last.skills[skill] ?? 0) * weight, 0);
    const bonusPerSeason =
      rawBonus >= lastBase * config.bonusCapRatio
        ? basePerSeason * config.bonusCapRatio
        : bonus.reduce((sum, [skill, weight]) => sum + Math.max(0, skillRates[skill]) * weight, 0);
    const gainPerSeason = basePerSeason + bonusPerSeason;

    const midAge =
      (historyEntryAge(first, currentExactAge) + historyEntryAge(last, currentExactAge)) / 2;
    const expectedPerSeason = expectedSeasonGain(midAge);

    return {
      position: positionName,
      pointsPerSeason,
      basePerSeason,
      bonusPerSeason,
      gainPerSeason,
      // Endpoint-to-endpoint on purpose: this is context for "the rating
      // itself moved", i.e. what actually happened over the calendar window.
      ratingMovedPerSeason:
        ((lastBase - positionBase(first.skills, weights)) / spanDays) * config.daysPerSeason,
      skillRates,
      expectedPerSeason,
      pace: expectedPerSeason === null ? null : gainPerSeason / expectedPerSeason,
      basePace: expectedPerSeason === null ? null : basePerSeason / expectedPerSeason,
      midAge,
      fromDate: first.date,
      toDate: last.date,
      spanDays,
      measuredDays: cleaned.measuredDays,
      skippedNoTrainingDays: cleaned.skippedNoTrainingDays,
      skippedCampDays: cleaned.skippedCampDays,
      provisional: cleaned.measuredDays < config.pace.minSpanDays,
      campDaysPerSeason,
      campDaysAssumed,
    };
  }

  /**
   * The highest base rating `points` skill points can buy for a position, if
   * they're spent where they raise the rating most: the bottleneck first, then
   * all main skills together at their weights. Solves
   * sum(max(0, R * weight - skill)) = points for R.
   */
  function solveBalancedRating(skills: TSkills, positionName: string, points: number): number | null {
    const weights = mainWeights(positionName);
    if (!weights || weights.length === 0) return null;

    const cost = (rating: number) =>
      weights.reduce((sum, [skill, weight]) => sum + Math.max(0, rating * weight - (skills[skill] ?? 0)), 0);

    const weightSum = weights.reduce((sum, [, weight]) => sum + weight, 0);
    const skillSum = weights.reduce((sum, [skill]) => sum + (skills[skill] ?? 0), 0);
    const highestThreshold = Math.max(...weights.map(([skill, weight]) => (skills[skill] ?? 0) / weight));

    // cost() is increasing, and at `high` it is already >= points: past the
    // highest threshold every skill is being paid for, so cost = R*sum - skills.
    let low = positionBase(skills, weights);
    let high = Math.max(highestThreshold, (Math.max(0, points) + skillSum) / weightSum);

    for (let i = 0; i < 60; i++) {
      const middle = (low + high) / 2;
      if (cost(middle) <= points) low = middle;
      else high = middle;
    }

    // Snap away bisection dust: overall rating floors each skill, so
    // 550.9999999 would lose a whole point that 551 keeps.
    return Math.round(low * 1e6) / 1e6;
  }

  /** The best position for a set of skills and its rating with bonus (no XP). */
  function bestPositionRating(skills: TSkills): { name: string; rating: number } {
    return positionsOf(skills).reduce(
      (best, position) =>
        position.ratingWithBonus > best.rating
          ? { name: position.name, rating: position.ratingWithBonus }
          : best,
      { name: "?", rating: -Infinity }
    );
  }

  /** Overall rating from skills: the sum of the skills, each rounded down. */
  function overallFromSkills(skills: TSkills): number {
    return SKILL_NAMES.reduce((sum, skill) => sum + Math.floor(skills[skill] ?? 0), 0);
  }

  /** The calendar date on which the player was (or will be) `targetAge`, as ISO. */
  function dateAtAge(currentExactAge: number, targetAge: number): string {
    const daysAgo = (currentExactAge - targetAge) * config.daysPerSeason;
    return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
  }

  /** The entry with skills closest to `isoDate`, within `maxDays` either side, or null. */
  function entryNearestDate(entries: Entry[], isoDate: string, maxDays: number): SkilledEntry | null {
    let best: SkilledEntry | null = null;
    let bestDistance = Infinity;

    for (const entry of entries) {
      if (!entry.skills) continue;
      const distance = Math.abs(daysBetween(isoDate, entry.date));
      if (distance <= maxDays && distance < bestDistance) {
        best = entry as SkilledEntry;
        bestDistance = distance;
      }
    }

    return best;
  }

  /**
   * Every skill projected to `targetAge`: the paced position's main skills as
   * solveBalancedRating() spends them, the rest at their own observed rates.
   * Null without a pace or skills, or at or past the target or the max age.
   */
  function projectSkills(
    skills: TSkills | undefined,
    currentExactAge: number,
    pace: GrowthPace<TSkills> | null,
    targetAge: number
  ): TSkills | null {
    if (!skills || !pace || pace.basePace === null || pace.expectedPerSeason === null) return null;
    if (currentExactAge >= Math.min(targetAge, config.projectionMaxAge)) return null;

    const weights = mainWeights(pace.position);
    if (!weights) return null;

    // Main skills are driven by the base part of the pace only; bonus skills
    // are projected below at their own rates and fed through the real bonus
    // formula - using the full pace here would count the bonus twice.
    //
    // The measured pace already includes the age factor for the age it was
    // measured at. Divide it out, then let each future year apply its own.
    const measuredFactor = agePaceFactor(pace.midAge);
    const underlyingPace = Math.max(0, pace.basePace) / measuredFactor;
    // Pace is camp-free, so future camps are added back here - to every
    // skill, as camps boost all training.
    const curveGain = adjustedCurveGainBetween(currentExactAge, targetAge, pace.campDaysPerSeason);
    const weightSum = weights.reduce((sum, [, weight]) => sum + weight, 0);
    const points = underlyingPace * curveGain * weightSum;

    const rating = solveBalancedRating(skills, pace.position, points);
    if (rating === null) return null;

    const main = new Map(weights);
    // The observed rate was measured when the reference's slope was
    // expectedPerSeason at that age's factor; scale it by the same
    // age-adjusted curve the main skills follow.
    const curveSeasons = curveGain / (pace.expectedPerSeason * measuredFactor);

    return Object.fromEntries(
      SKILL_NAMES.map((skill) => {
        const current = skills[skill] ?? 0;
        const weight = main.get(skill);
        const value =
          weight !== undefined
            ? Math.max(current, rating * weight)
            : current + Math.max(0, pace.skillRates[skill]) * curveSeasons;
        return [skill, value];
      })
    ) as TSkills;
  }

  /** The paced position's rating (no XP) at `targetAge`, through the real position formula. */
  function projectPositionRating(
    skills: TSkills | undefined,
    currentExactAge: number,
    pace: GrowthPace<TSkills> | null,
    targetAge: number
  ): number | null {
    const projected = projectSkills(skills, currentExactAge, pace, targetAge);
    return projected && pace ? positionRating(projected, pace.position) : null;
  }

  /** The overall rating at `targetAge` - the sum of the same projected skills. */
  function projectOverallRating(
    skills: TSkills | undefined,
    currentExactAge: number,
    pace: GrowthPace<TSkills> | null,
    targetAge: number
  ): number | null {
    const projected = projectSkills(skills, currentExactAge, pace, targetAge);
    return projected ? overallFromSkills(projected) : null;
  }

  /**
   * Chart points for the projection line: the current rating for the paced
   * position, then one point per whole age up to `untilAge` (capped at the max
   * age). Empty without a pace.
   */
  function projectionPoints(
    skills: TSkills | undefined,
    currentExactAge: number,
    pace: GrowthPace<TSkills> | null,
    untilAge: number
  ): { x: number; y: number }[] {
    if (!skills || !pace || pace.basePace === null) return [];

    const current = positionRating(skills, pace.position);
    if (current === null) return [];

    const endAge = Math.min(untilAge, config.projectionMaxAge);
    const points = [{ x: currentExactAge, y: current }];

    for (let age = Math.floor(currentExactAge) + 1; age <= endAge; age++) {
      const y = projectPositionRating(skills, currentExactAge, pace, age);
      if (y !== null) points.push({ x: age, y });
    }

    return points.length > 1 ? points : [];
  }

  const squadXpShare = (age: number) =>
    [...config.xpShares].reverse().find((band) => age >= band.fromAge)!.share;

  /** The table's `exp` at an exact age, interpolated between whole ages. */
  function topExpAt(age: number): number {
    const first = table[0];
    const last = table[table.length - 1];
    if (age <= first.age) return first.exp;
    if (age >= last.age) return last.exp;

    const whole = Math.floor(age);
    const from = table.find((p) => p.age === whole)!;
    const to = table.find((p) => p.age === whole + 1)!;
    return from.exp + (to.exp - from.exp) * (age - whole);
  }

  /**
   * XP at `targetAge`: each future year gains the table's XP gain for that
   * year times the player's share - his own current share, never below the
   * squad's typical share for that age. Rests on today's XP alone.
   */
  function projectExperience(experience: number, currentExactAge: number, targetAge: number): number {
    const topNow = topExpAt(currentExactAge);
    const ownShare = topNow > 0 ? experience / topNow : 0;

    let xp = experience;
    let age = currentExactAge;
    while (age < targetAge) {
      const segmentEnd = Math.min(Math.floor(age) + 1, targetAge);
      const share = Math.max(ownShare, squadXpShare(age));
      xp += (topExpAt(segmentEnd) - topExpAt(age)) * share;
      age = segmentEnd;
    }
    return xp;
  }

  /**
   * The projected peak: rating with XP at the potential age, using the same
   * model as the @25 columns plus projected XP. Players at or past that age
   * show where they are now - past XP isn't stored.
   */
  function projectPotential(
    skills: TSkills | undefined,
    experience: number | undefined,
    currentExactAge: number,
    pace: GrowthPace<TSkills> | null,
    current: { rating: number; ratingWithXp: number }
  ): Potential | null {
    if (currentExactAge >= config.potentialAge) {
      return { ...current, xp: experience ?? 0, kind: "current" };
    }
    if (experience === undefined) return null;

    const rating = projectPositionRating(skills, currentExactAge, pace, config.potentialAge);
    if (rating === null) return null;

    const xp = projectExperience(experience, currentExactAge, config.potentialAge);
    return { rating, xp, ratingWithXp: calculateSkillWithExp(rating, xp), kind: "projected" };
  }

  return {
    agePaceFactor,
    historyEntryAge,
    expectedSeasonGain,
    curveGainBetween,
    adjustedCurveGainBetween,
    measureGrowthPace,
    solveBalancedRating,
    projectPositionRating,
    bestPositionRating,
    overallFromSkills,
    projectOverallRating,
    dateAtAge,
    entryNearestDate,
    projectSkills,
    projectionPoints,
    topExpAt,
    projectExperience,
    projectPotential,
  };
}
