/**
 * The sports whose players the extension stores. Every storage layer - the
 * player caches, the skill-history stores and the backup - is keyed by sport,
 * so the same player id in two games can never collide.
 *
 * Hockey was the only sport for a long time, so every sport-aware API takes
 * `sport` as an optional last argument defaulting to "hockey", and hockey's
 * existing storage (cache keys, history store, backup files) keeps its names.
 */
export type Sport = "hockey" | "basketball" | "soccer";

export const SPORTS: readonly Sport[] = ["hockey", "basketball", "soccer"];

/**
 * The skill-history object store for a sport. Hockey's keeps its original
 * name, so no hockey data had to move when basketball was added.
 */
export function historyStoreName(sport: Sport): string {
  return sport === "hockey" ? "skillHistory" : `skillHistory_${sport}`;
}
