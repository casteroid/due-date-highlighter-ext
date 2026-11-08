import type { MatchContext } from "./context";
import type { ResolvedSettings } from "./settings";

export type Rejection = "no-keyword" | "ignored" | "too-far";

const normalise = (keywords: string[]) => keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);

/** Why a date should not be highlighted, or null if it should. Keywords match as case-insensitive substrings. */
export function evaluateCriteria(
  ctx: MatchContext,
  daysUntil: number,
  s: Pick<ResolvedSettings, "contextKeywords" | "ignoreKeywords" | "maxDistanceDays">,
): Rejection | null {
  if (Math.abs(daysUntil) > s.maxDistanceDays) return "too-far";
  const haystack = [ctx.before, ctx.columnHeader, ctx.sectionHeading].filter(Boolean).join(" ").toLowerCase();
  if (normalise(s.ignoreKeywords).some((k) => haystack.includes(k))) return "ignored";
  const wanted = normalise(s.contextKeywords);
  if (wanted.length > 0 && !wanted.some((k) => haystack.includes(k))) return "no-keyword";
  return null;
}
