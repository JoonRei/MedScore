export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function normalizeCodeName(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function displayStudentName(student: { first_name: string; last_name: string }) {
  return `${student.last_name}, ${student.first_name}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function scoreFill(score: number | null | undefined, total: number | null | undefined) {
  const earned = Number(score);
  const possible = Number(total);
  if (!Number.isFinite(earned) || !Number.isFinite(possible) || possible <= 0) return 0;
  return Math.max(0, Math.min(100, (earned / possible) * 100));
}

export function formatRawAverage(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
