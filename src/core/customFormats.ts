import { isValidDate, type Ymd } from "./dates";
import { BUILTIN_FORMATS, touchesNeighbour, type DateFormat, type RawMatch } from "./formats";
import { lookupMonth, type NameTables } from "./languages";
import type { CustomFormat } from "./types";

/** `date.y` is 0 when the pattern has no year group (the year is resolved later, at scan time). */
export type CustomTestMatch = { text: string; date: Ymd | null; reason?: string };
export type CustomTestResult = { error?: string; matches: CustomTestMatch[] };

type Hit = { index: number; length: number; text: string; result: { date: Ymd; y?: number } | { reason: string } };

function compile(cf: CustomFormat): RegExp | { error: string } {
  let re: RegExp;
  try {
    re = new RegExp(cf.pattern, "giu");
  } catch (e) {
    return { error: `Invalid regex: ${(e as Error).message}` };
  }
  if (!cf.pattern.includes("(?<d>") || !cf.pattern.includes("(?<m>")) {
    return { error: "Pattern needs named groups (?<d>…) and (?<m>…)" };
  }
  return re;
}

function evaluate(re: RegExp, text: string, tables: NameTables): Hit[] {
  const hits: Hit[] = [];
  for (const m of text.matchAll(re)) {
    if (m[0].length === 0) continue;
    const base = { index: m.index, length: m[0].length, text: m[0] };
    const groups = m.groups ?? {};
    const rawMonth = groups.m ?? "";
    const month = /^\d+$/.test(rawMonth) ? Number(rawMonth) : (lookupMonth(tables, rawMonth)?.value ?? null);
    const day = Number(groups.d);
    const rawYear = groups.y;
    const year = rawYear ? (rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear)) : undefined;

    let result: Hit["result"];
    if (month === null) result = { reason: "month name not recognised" };
    else if (!Number.isInteger(day) || day < 1 || day > 31 || month < 1 || month > 12) result = { reason: "day/month out of range" };
    else if (!isValidDate({ y: year ?? 2000, m: month, d: day })) result = { reason: "impossible date" };
    else if (touchesNeighbour(text, m.index, m[0].length)) result = { reason: "touches another letter or digit" };
    else result = { date: { y: year ?? 0, m: month, d: day }, y: year };
    hits.push({ ...base, result });
  }
  return hits;
}

export function compileCustomFormat(cf: CustomFormat, tables: NameTables): DateFormat | { error: string } {
  const re = compile(cf);
  if (!(re instanceof RegExp)) return re;
  return {
    id: `custom:${cf.id}`,
    label: cf.label || cf.pattern,
    examples: [],
    defaultEnabled: true,
    find(text) {
      const out: RawMatch[] = [];
      for (const hit of evaluate(re, text, tables)) {
        if ("date" in hit.result) out.push({ index: hit.index, length: hit.length, y: hit.result.y, m: hit.result.date.m, d: hit.result.date.d });
      }
      return out;
    },
  };
}

/** Same pipeline as `find`, but keeps rejected hits with the reason, for the options page tester. */
export function testCustomFormat(cf: CustomFormat, sample: string, tables: NameTables): CustomTestResult {
  const re = compile(cf);
  if (!(re instanceof RegExp)) return { error: re.error, matches: [] };
  return {
    matches: evaluate(re, sample, tables).map((hit) =>
      "date" in hit.result
        ? { text: hit.text, date: hit.result.date }
        : { text: hit.text, date: null, reason: hit.result.reason },
    ),
  };
}

/** Built-in formats followed by every custom format that compiles. */
export function buildRegistry(customFormats: CustomFormat[], tables: NameTables): DateFormat[] {
  const custom = customFormats
    .map((cf) => compileCustomFormat(cf, tables))
    .filter((f): f is DateFormat => !("error" in f));
  return [...BUILTIN_FORMATS, ...custom];
}
