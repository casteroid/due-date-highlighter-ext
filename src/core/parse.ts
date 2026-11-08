import { daysUntil, resolveYear, type Ymd } from "./dates";
import type { DateFormat, FindContext, RawMatch } from "./formats";

export type ParsedMatch = RawMatch & { formatId: string; text: string; date: Ymd; daysUntil: number };

type Tagged = RawMatch & { formatId: string; order: number };

const AMBIGUOUS_PAIR = { dmy: "dmy-numeric", mdy: "mdy-numeric" } as const;

/** Runs every format over `text`, settles numeric ambiguity, keeps the longest of overlapping matches. */
export function findDates(text: string, formats: DateFormat[], ctx: FindContext): ParsedMatch[] {
  let all: Tagged[] = formats.flatMap((f, order) => f.find(text, ctx).map((m) => ({ ...m, formatId: f.id, order })));

  const preferred = AMBIGUOUS_PAIR[ctx.ambiguous];
  const other = AMBIGUOUS_PAIR[ctx.ambiguous === "dmy" ? "mdy" : "dmy"];
  const preferredSpans = new Set(all.filter((m) => m.formatId === preferred).map((m) => `${m.index}:${m.length}`));
  all = all.filter((m) => m.formatId !== other || !preferredSpans.has(`${m.index}:${m.length}`));

  all.sort((a, b) => a.index - b.index || b.length - a.length || a.order - b.order);
  const kept: Tagged[] = [];
  let end = -1;
  for (const m of all) {
    if (m.index < end) continue;
    kept.push(m);
    end = m.index + m.length;
  }

  const out: ParsedMatch[] = [];
  for (const { order: _order, ...m } of kept) {
    const date = m.y === undefined ? resolveYear(m.m, m.d, ctx.today) : { y: m.y, m: m.m, d: m.d };
    if (!date) continue;
    out.push({ ...m, y: date.y, text: text.slice(m.index, m.index + m.length), date, daysUntil: daysUntil(date, ctx.today) });
  }
  return out;
}
