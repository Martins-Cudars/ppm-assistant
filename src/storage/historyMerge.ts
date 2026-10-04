/**
 * Merging two captures of the same player/day into one history entry. Pure,
 * so the background worker can apply it and the checks can test it.
 */

import { SkillHistoryEntry } from "@/types/SkillHistory";

type Entry = SkillHistoryEntry<unknown>;
type SkillMap = Record<string, number>;

const asSkillMap = (skills: unknown): SkillMap | null =>
  skills && typeof skills === "object" ? (skills as SkillMap) : null;

const hasDecimals = (skills: SkillMap) =>
  Object.values(skills).some((value) => typeof value === "number" && !Number.isInteger(value));

/**
 * Whether `incoming` is the same day seen less precisely: the stored skills
 * have decimals (the training-progress page), the incoming ones are all whole
 * numbers (the squad overview or a profile), and each is the stored value
 * rounded down - which is how the game shows them.
 */
function isCoarserViewOf(stored: SkillMap, incoming: SkillMap): boolean {
  if (!hasDecimals(stored) || hasDecimals(incoming)) return false;
  const keys = Object.keys(incoming);
  return keys.length > 0 && keys.every((key) => incoming[key] === Math.floor(stored[key]));
}

/**
 * Combines an incoming entry with whatever is already stored for that
 * player/day. The capture paths each supply only part of an entry - the
 * training progress page has skills, the profile of an unscouted opponent has
 * only an overall rating - and they can land on the same key, so a plain put()
 * would let whichever ran last erase the other's fields.
 *
 * Incoming values win where present; existing values survive where the
 * incoming entry has nothing to say.
 *
 * One exception: decimal skills are not replaced by the same values rounded
 * down. Opening the squad overview after gathering used to turn that day's
 * 72.94 into 72 - and the day is the anchor of the pace window, so every skill
 * lost up to a point at the end. The stored skills and their `source` are
 * kept; everything else still merges. Skills that differ beyond rounding are
 * newer information and win as before, and decimals always replace stored
 * whole numbers, so re-gathering repairs days that were already flattened.
 */
export function mergeHistoryEntry(existing: Entry | undefined, incoming: Entry): Entry {
  if (!existing) return incoming;

  const stored = asSkillMap(existing.skills);
  const fresh = asSkillMap(incoming.skills);
  const keepStoredSkills = stored !== null && fresh !== null && isCoarserViewOf(stored, fresh);

  return {
    ...existing,
    ...incoming,
    overallRating: incoming.overallRating ?? existing.overallRating ?? existing.kr,
    skills: keepStoredSkills ? existing.skills : (incoming.skills ?? existing.skills),
    // The source says how precise the skills are (see isWholeNumberCapture),
    // so it stays with the skills that were kept.
    source: keepStoredSkills ? existing.source : (incoming.source ?? existing.source),
    height: incoming.height ?? existing.height,
    experience: incoming.experience ?? existing.experience,
  };
}
