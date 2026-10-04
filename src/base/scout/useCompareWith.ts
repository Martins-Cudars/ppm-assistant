/**
 * The Player Report's "Compare with: Squad · League · Elite" toggle, for any
 * sport. One choice drives:
 *
 * - the chart's reference line (`referenceOptions`, `chartReferenceKey`);
 * - "OR vs best": the player's OR against the chosen group's best OR at his age.
 *   A level, so single roster visits are enough;
 * - Pace: against the chosen group's growth rate once RATE_MIN_PAIRS players
 *   from other teams were seen twice. Until then, and under Squad, it is the
 *   sport's own pace, as before.
 *
 * Projections don't follow it - they stay on each sport's own model.
 */

import { computed, ref, watch } from "vue";
import type { GrowthReference, GrowthReferenceOption } from "@/components/growthChartTypes";
import {
  GroupRatePoint,
  OWN_RATE_MIN_DAYS,
  OWN_RATE_WINDOW_DAYS,
  RATE_MIN_DAYS,
  RATE_MIN_PAIRS,
  ScoutPoint,
  bestOrAt,
  buildScoutReferences,
  groupRateByAge,
  leagueSnapshots,
  ownOrRate,
  scoutCoverage,
  scoutRatePairs,
  scoutedPairCount,
} from "@/base/scout/scoutReference";
import { LeagueTeams, ScoutSnapshot } from "@/types/ScoutSnapshot";
import { Sport } from "@/types/Sport";
import { GROWTH_RAMP, heatStyle } from "@/components/heatmap";

/** What the Pace column shows for a player. */
export type ShownPace = { pace: number; provisional: boolean; title: string };
export type OrVsBest = { share: number; best: number; note?: string };

export const COMPARE_OPTIONS = [
  { key: "squad", name: "Squad" },
  { key: "league", name: "League" },
  { key: "elite", name: "Elite" },
] as const;
export type CompareKey = (typeof COMPARE_OPTIONS)[number]["key"];
const isCompareKey = (value: unknown): value is CompareKey =>
  COMPARE_OPTIONS.some((option) => option.key === value);

const round2 = (value: number) => Math.round(value * 100) / 100;

export interface CompareInputs<P> {
  sport: Sport;
  daysPerSeason: number;
  // Getters, so the computeds below follow the report's reactive state.
  players: () => P[];
  snapshots: () => ScoutSnapshot[];
  league: () => LeagueTeams | null;
  /** The user's team id, or "unknown". Its players don't count toward the ready rule. */
  ownTeamId: () => string;
  /** The chart's Squad option: the sport's own Skill line and the squad's best OR. */
  squadReference: () => GrowthReference;
  squadChartCaption: string;
  /** The line under the toggle when Squad is chosen. */
  squadCaption: string;

  idOf: (player: P) => string;
  exactAgeOf: (player: P) => number;
  overallOf: (player: P) => number;
  /** The sport's own pace, shown under Squad and until a group is ready. */
  squadPace: (player: P) => ShownPace | null;
  squadPaceMissingTitle: (player: P) => string;
  /** The player's stored days with an OR, for his own OR rate. */
  ownOrDays: (player: P) => { date: string; or: number }[];
  /** The player's age on a stored date. */
  ageOnDate: (player: P, date: string) => number;
  /** The sport's own age curve, any unit, for ages a group has no pairs at. */
  rateShape: (age: number) => number;
}

export function useCompareWith<P>(inputs: CompareInputs<P>) {
  const storageKey = `ppm-assistant:report:${inputs.sport}:compare`;
  const readCompare = (): CompareKey => {
    try {
      const saved = localStorage.getItem(storageKey);
      return isCompareKey(saved) ? saved : "squad";
    } catch {
      return "squad";
    }
  };
  const compareWith = ref<CompareKey>(readCompare());
  watch(compareWith, (key) => {
    try {
      localStorage.setItem(storageKey, key);
    } catch {
      // Not remembered this time; the toggle still works.
    }
  });
  // The chart's own buttons write a plain string (or null); keep only our keys.
  const chartReferenceKey = computed<string | null>({
    get: () => compareWith.value,
    set: (key) => {
      if (isCompareKey(key)) compareWith.value = key;
    },
  });
  const compareName = computed(
    () => COMPARE_OPTIONS.find((option) => option.key === compareWith.value)!.name
  );

  // --- The lines -------------------------------------------------------------------

  const scoutReferences = computed(() =>
    buildScoutReferences(inputs.snapshots(), inputs.league(), inputs.daysPerSeason)
  );
  const scoutedCoverage = computed(() => scoutCoverage(inputs.snapshots()));

  // The scouted lines are OR only, so they are offered on the chart's OR tab.
  const referenceOptions = computed<GrowthReferenceOption[]>(() => [
    {
      key: "squad",
      name: "Squad",
      reference: inputs.squadReference(),
      caption: inputs.squadChartCaption,
    },
    {
      key: "league",
      name: "League",
      reference: { label: "League best at each age", skill: [], or: scoutReferences.value.league.points },
      caption: scoutReferences.value.league.caption,
    },
    {
      key: "elite",
      name: "Elite",
      reference: { label: "Elite best at each age", skill: [], or: scoutReferences.value.elite.points },
      caption: scoutReferences.value.elite.caption,
    },
  ]);

  // --- OR vs best --------------------------------------------------------------------

  const levelPoints = computed<ScoutPoint[]>(() => {
    if (compareWith.value === "league") return scoutReferences.value.league.points;
    if (compareWith.value === "elite") return scoutReferences.value.elite.points;
    return inputs.squadReference().or;
  });

  const orVsBestByPlayer = computed(() => {
    const values = new Map<string, OrVsBest | null>();
    inputs.players().forEach((player) => {
      const overall = inputs.overallOf(player);
      const best = bestOrAt(levelPoints.value, inputs.exactAgeOf(player));
      values.set(
        inputs.idOf(player),
        best && best.value > 0 && overall > 0
          ? { share: overall / best.value, best: best.value, note: best.note }
          : null
      );
    });
    return values;
  });
  const orVsBestFor = (player: P) => orVsBestByPlayer.value.get(inputs.idOf(player)) ?? null;
  const orVsBestTitle = (player: P) => {
    const value = orVsBestFor(player);
    if (!value) {
      return compareWith.value === "squad"
        ? "No squad player was recorded at this age"
        : `${compareName.value}: no scouted player of this age yet`;
    }
    const whose = value.note ? ` (${value.note})` : "";
    return (
      `OR ${inputs.overallOf(player)} of ${Math.round(value.best)}: the best OR at age ` +
      `${inputs.exactAgeOf(player).toFixed(1)} - ${compareName.value}${whose}`
    );
  };

  // --- Pace --------------------------------------------------------------------------

  /**
   * The chosen group's pace reference, or null while it isn't usable. Pairs of
   * the user's own players don't count toward the ready rule - the squad is
   * snapshotted on every overview visit and would make a group "ready" by
   * itself. Once ready, they are part of the group like anyone else's.
   */
  const groupRates = computed(() => {
    if (compareWith.value === "squad") return null;
    const snapshots =
      compareWith.value === "league"
        ? leagueSnapshots(inputs.snapshots(), inputs.league())
        : inputs.snapshots();
    const pairs = scoutRatePairs(snapshots, inputs.daysPerSeason);
    const ownTeamId = inputs.ownTeamId();
    const scouted = scoutedPairCount(pairs, ownTeamId !== "unknown" ? ownTeamId : undefined);
    return {
      pairs: scouted,
      curve: scouted >= RATE_MIN_PAIRS ? groupRateByAge(pairs, inputs.rateShape) : null,
    };
  });
  const groupRateCurve = computed<GroupRatePoint[] | null>(() => groupRates.value?.curve ?? null);

  const shownPaceByPlayer = computed(() => {
    const values = new Map<string, ShownPace | null>();
    const rateCurve = groupRateCurve.value;
    inputs.players().forEach((player) => {
      const id = inputs.idOf(player);
      if (!rateCurve) {
        values.set(id, inputs.squadPace(player));
        return;
      }
      const own = ownOrRate(inputs.ownOrDays(player));
      // The window ends at the player's last stored day, which may be weeks ago.
      const midAge = own
        ? (inputs.ageOnDate(player, own.fromDate) + inputs.ageOnDate(player, own.toDate)) / 2
        : inputs.exactAgeOf(player);
      const point = rateCurve.find((p) => p.age === Math.floor(midAge));
      if (!own || !point || point.perDay <= 0) {
        values.set(id, null);
        return;
      }
      const names = point.top.map((rate) => rate.name ?? "a player").join(", ");
      values.set(id, {
        pace: own.perDay / point.perDay,
        provisional: false,
        title: [
          `${round2(own.perDay)} OR per day (${own.fromDate} to ${own.toDate}, ${own.days} days)`,
          `100% at ${point.age} = ${round2(point.perDay)} OR per day - ${compareName.value}: ` +
            (point.source === "measured"
              ? `mean of the fastest ${point.top.length} (${names})`
              : "nobody measured at this age, filled from the sport's own age curve"),
          "Calendar days on both sides: camp and no-training days are included.",
        ].join("\n"),
      });
    });
    return values;
  });
  const shownPaceFor = (player: P) => shownPaceByPlayer.value.get(inputs.idOf(player)) ?? null;
  const shownPaceMissingTitle = (player: P) =>
    groupRateCurve.value
      ? `Needs ${OWN_RATE_MIN_DAYS} days of history within the last ${OWN_RATE_WINDOW_DAYS}`
      : inputs.squadPaceMissingTitle(player);
  const paceHeader = computed(() => (groupRateCurve.value ? `Pace vs ${compareName.value}` : "Pace"));

  /** One line under the toggle: what the level rests on, and where Pace stands. */
  const compareCaption = computed(() => {
    if (compareWith.value === "squad") return inputs.squadCaption;
    const level = scoutReferences.value[compareWith.value].caption;
    const rates = groupRates.value!;
    const pace = rates.curve
      ? `Pace: against the fastest ${compareName.value} players at each age (${rates.pairs} from other teams seen twice).`
      : `Pace still shows Squad: ${rates.pairs} of ${RATE_MIN_PAIRS} other teams' ${compareName.value} players seen twice, ` +
        `${RATE_MIN_DAYS}+ days apart - reopen the same teams' Players pages later.`;
    return `${level}. ${pace}`;
  });

  /**
   * The table's "OR vs best" and Pace columns, for the Growth group. Plain
   * objects in SortableTable's Column shape (its type lives in a .vue file,
   * which tsc can't read). Each report renders both with PercentCell.vue.
   */
  const compareColumns = (ranges: {
    orVsBest: { min: number; max: number };
    pace: { min: number; max: number };
  }) => [
    {
      header: "OR vs best",
      key: "orVsBest",
      slot: "orVsBest",
      sortable: true,
      group: "Growth",
      align: "right" as const,
      sortValue: (player: P) => orVsBestFor(player)?.share ?? null,
      cellStyle: (player: P) =>
        heatStyle(orVsBestFor(player)?.share, ranges.orVsBest.min, ranges.orVsBest.max, GROWTH_RAMP),
    },
    {
      header: paceHeader.value,
      key: "pace",
      slot: "pace",
      sortable: true,
      group: "Growth",
      align: "right" as const,
      // Null sorts last, so players with no measurable pace stay out of the way.
      sortValue: (player: P) => shownPaceFor(player)?.pace ?? null,
      cellStyle: (player: P) =>
        heatStyle(shownPaceFor(player)?.pace, ranges.pace.min, ranges.pace.max, GROWTH_RAMP),
    },
  ];

  return {
    COMPARE_OPTIONS,
    compareColumns,
    compareWith,
    chartReferenceKey,
    compareName,
    compareCaption,
    referenceOptions,
    scoutedCoverage,
    orVsBestFor,
    orVsBestTitle,
    shownPaceFor,
    shownPaceMissingTitle,
    paceHeader,
    groupRateCurve,
  };
}
