export function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export function formatScore(n: number): string {
  return n.toFixed(1);
}

export function formatUpdatedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function rankChangeLabel(change: number | null | undefined): string {
  if (change == null || change === 0) return "—";
  if (change > 0) return `↑${change}`;
  return `↓${Math.abs(change)}`;
}
