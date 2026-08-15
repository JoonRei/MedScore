export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function normalizeCodeName(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function displayStudentName(student: { first_name: string; last_name: string }) {
  return `${student.last_name}, ${student.first_name}`;
}

export function percent(score: number, total: number) {
  if (!total) return 0;
  return (score / total) * 100;
}

export function weightedPercent(rows: Array<{ score: number; total: number }>) {
  const earned = rows.reduce((sum, row) => sum + Number(row.score || 0), 0);
  const possible = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  return possible ? (earned / possible) * 100 : 0;
}

export function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
