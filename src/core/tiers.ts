import type { Tier, TierProfile } from "./types";

export function pickTier(profile: TierProfile, days: number): Tier | null {
  return (
    profile.tiers.find(
      (t) => t.enabled && (t.minDays === null || days >= t.minDays) && (t.maxDays === null || days <= t.maxDays),
    ) ?? null
  );
}

const fmt = (n: number) => (n === -Infinity ? "-∞" : n === Infinity ? "+∞" : String(n));

/** Overlaps and gaps between enabled tiers, for display in the options page. */
export function tierRangeWarnings(tiers: Tier[]): string[] {
  const ranges = tiers
    .filter((t) => t.enabled)
    .map((t) => ({ name: t.name, lo: t.minDays ?? -Infinity, hi: t.maxDays ?? Infinity }));
  const warnings: string[] = [];

  for (const r of ranges) {
    if (r.lo > r.hi) warnings.push(`Tier ${r.name} has min greater than max and never matches`);
  }
  const valid = ranges.filter((r) => r.lo <= r.hi);

  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i]!;
      const b = valid[j]!;
      const lo = Math.max(a.lo, b.lo);
      const hi = Math.min(a.hi, b.hi);
      if (lo <= hi) warnings.push(`Tier ${a.name} and Tier ${b.name} overlap on ${fmt(lo)}..${fmt(hi)}; the first match wins`);
    }
  }

  const sorted = [...valid].sort((a, b) => a.lo - b.lo);
  let coveredTo = -Infinity;
  let first = true;
  for (const r of sorted) {
    if (!first && r.lo > coveredTo + 1) warnings.push(`No tier covers ${fmt(coveredTo + 1)}..${fmt(r.lo - 1)}`);
    coveredTo = first ? r.hi : Math.max(coveredTo, r.hi);
    first = false;
  }
  return warnings;
}
