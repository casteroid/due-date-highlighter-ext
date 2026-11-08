import type { BadgeStyle } from "./types";

export type Ymd = { y: number; m: number; d: number };

const DAY_MS = 86_400_000;

export function isValidDate({ y, m, d }: Ymd): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Whole local calendar days from `today` to `date`; the time of day of `today` is ignored. */
export function daysUntil({ y, m, d }: Ymd, today: Date): number {
  const target = Date.UTC(y, m - 1, d);
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / DAY_MS);
}

/** Nearest occurrence of a year-less date; on a tie the future one wins. */
export function resolveYear(m: number, d: number, today: Date): Ymd | null {
  const year = today.getFullYear();
  let best: { date: Ymd; days: number } | null = null;
  for (const y of [year - 1, year, year + 1]) {
    const date = { y, m, d };
    if (!isValidDate(date)) continue;
    const days = daysUntil(date, today);
    if (best === null || Math.abs(days) < Math.abs(best.days) || (Math.abs(days) === Math.abs(best.days) && days > 0)) {
      best = { date, days };
    }
  }
  return best?.date ?? null;
}

export function todayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatYmd({ y, m, d }: Ymd): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function badgeLabel(days: number, style: BadgeStyle): string {
  if (days === 0) return "today";
  if (style === "signed") return days > 0 ? `+${days}d` : `${days}d`;
  return days < 0 ? `${-days}d ago` : `in ${days}d`;
}

/** Display only: uses the browser locale by design. */
export function relativeLabel(days: number, locale: string = navigator.language): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
}
