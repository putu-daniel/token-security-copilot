// Display helpers shared by components.
export const fmtUsd = (n: number | null | undefined) => {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Number(n).toFixed(2)}`;
};
export const fmtAgeH = (h: number | null | undefined) => {
  if (h == null) return "unknown";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
};
export const pct = (f: number | null | undefined) =>
  f == null || isNaN(f) ? "—" : `${(f * 100).toFixed(1)}%`;
export const shortAddr = (a: string) =>
  a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "?";
export const lvlColor = (l: string) =>
  l === "danger" ? "var(--danger)" : l === "warn" ? "var(--warn)" : "var(--safe)";
