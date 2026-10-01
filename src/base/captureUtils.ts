/**
 * Small helpers every sport's capture shares: ids, dates and number checks.
 */

/** Today as "YYYY-MM-DD" in local time - the same convention as hockey's capture. */
export function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export const isUsableNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * The numeric player id from whatever a parser stored. A squad-overview
 * parser may keep the whole profile link as the id; hockey pulls the number
 * from the link's `data=` parameter, and profile parsers can fall back to the
 * last path segment. Accept all three, and reject anything that isn't a
 * number, so a stray link (a country flag's "data=lva") never becomes a
 * phantom player.
 */
export function normalizePlayerId(raw: string | undefined): string | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return raw;

  const fromData = raw.split("data=")[1]?.split(/[-&#]/)[0];
  if (fromData && /^\d+$/.test(fromData)) return fromData;

  const fromPath = raw.split(/[?#]/)[0].split("/").pop()?.match(/^(\d+)/)?.[1];
  return fromPath ?? null;
}

/** A number from page text, ignoring separators ("1 078" -> 1078); NaN when there are no digits. */
export function parseDigits(text: string | null | undefined): number {
  const digits = (text ?? "").replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : NaN;
}

/**
 * Drops English thousands commas - "1,598" -> "1598" - for parseFloat (callers
 * strip spaces, the other separator, themselves). Skills use "." for decimals
 * ("72.02"), so a comma is only a separator when exactly 3 digits follow it.
 * Before this the training-progress parser read "1,598" as 1, and every soccer
 * OR of 1000+ was stored as 1 (repaired in src/background.ts).
 */
export function stripThousands(raw: string): string {
  return raw.replace(/,(?=\d{3}(?!\d))/g, "");
}
