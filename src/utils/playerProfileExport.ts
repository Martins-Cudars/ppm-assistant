export type CsvValue = string | number | boolean | null;
export type CsvRow = Record<string, CsvValue>;

export function normalizePositionName(position: string): string {
  return position === "?" ? "unknown" : position.toLowerCase();
}

export function setCsvValue(
  row: CsvRow,
  key: string,
  value: CsvValue | undefined
): void {
  row[key] = value ?? null;
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function serializeCsvRow(row: CsvRow): string {
  const headers = Object.keys(row);
  const values = headers.map((header) => escapeCsvValue(row[header]));

  return `${headers.join(",")}\n${values.join(",")}`;
}
