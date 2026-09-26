export function formatCount(n: number): string {
  return n.toLocaleString();
}

export function formatMiles(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(2)} mi`;
}

export function formatDays(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 365) {
    const years = n / 365;
    return `${n.toLocaleString()} days (~${years.toFixed(1)} yr)`;
  }
  return `${n.toLocaleString()} days`;
}

export function formatCoord(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "Pending";
  return value.toFixed(5);
}

export function formatDateLabel(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
