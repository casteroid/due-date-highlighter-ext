import * as de from "chrono-node/de";
import * as en from "chrono-node/en";
import * as es from "chrono-node/es";
import * as fr from "chrono-node/fr";
import * as it from "chrono-node/it";
import * as pt from "chrono-node/pt";
import { isValidDate } from "./dates";
import {
  baseLang,
  lookupMonths,
  lookupWeekdays,
  monthPattern,
  shortNameAllowedWithoutYear,
  weekdayPattern,
  type NameEntry,
  type NameTables,
} from "./languages";

export type FindContext = { lang: string | null; tables: NameTables; ambiguous: "dmy" | "mdy"; today: Date };
export type RawMatch = { index: number; length: number; y?: number; m: number; d: number };
export type DateFormat = {
  id: string;
  label: string;
  examples: string[];
  defaultEnabled: boolean;
  find(text: string, ctx: FindContext): RawMatch[];
};

/** A date may not touch a letter or digit on either side. */
export const LEFT_GUARD = "(?<![\\p{L}\\p{N}])";
export const RIGHT_GUARD = "(?![\\p{L}\\p{N}])";
const ALNUM = /[\p{L}\p{N}]/u;

export function touchesNeighbour(text: string, index: number, length: number): boolean {
  return ALNUM.test(text[index - 1] ?? "") || ALNUM.test(text[index + length] ?? "");
}

export function scanRegex(re: RegExp, text: string, toMatch: (m: RegExpExecArray) => RawMatch | null): RawMatch[] {
  const out: RawMatch[] = [];
  for (const m of text.matchAll(re)) {
    const match = toMatch(m as RegExpExecArray);
    if (match && isValidDate({ y: match.y ?? 2000, m: match.m, d: match.d })) out.push(match);
  }
  return out;
}

const regexCache = new WeakMap<NameTables, Map<string, RegExp>>();

/** Compiles (once per name table) a regex whose source depends on the month/weekday tables. */
function tableRegex(tables: NameTables, key: string, build: () => string, flags = "giu"): RegExp {
  let byKey = regexCache.get(tables);
  if (!byKey) regexCache.set(tables, (byKey = new Map()));
  let re = byKey.get(key);
  if (!re) byKey.set(key, (re = new RegExp(build(), flags)));
  return re;
}

const int = (s: string | undefined) => (s === undefined ? NaN : Number.parseInt(s, 10));
const ORD = "(?:st|nd|rd|th)?";

function englishMonth(tables: NameTables, raw: string | undefined): NameEntry | null {
  return raw === undefined ? null : (lookupMonths(tables, raw, ["en"])[0] ?? null);
}

function simple(re: RegExp, groups: { y?: number; m: number; d: number }) {
  return (text: string): RawMatch[] =>
    scanRegex(re, text, (m) => ({
      index: m.index,
      length: m[0].length,
      y: groups.y === undefined ? undefined : int(m[groups.y]),
      m: int(m[groups.m]),
      d: int(m[groups.d]),
    }));
}

const iso: DateFormat = {
  id: "iso",
  label: "2026-10-25",
  examples: ["2026-10-25", "2026-10-25T14:30"],
  defaultEnabled: true,
  find: simple(
    new RegExp(
      `${LEFT_GUARD}(\\d{4})-(\\d{2})-(\\d{2})(?:[T ]\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?(?:Z|[+-]\\d{2}:?\\d{2})?)?${RIGHT_GUARD}`,
      "gu",
    ),
    { y: 1, m: 2, d: 3 },
  ),
};

const MDY_BODY = (month: string) => `(${month})\\.?\\s+(\\d{1,2})${ORD},?\\s+(\\d{4})`;
const DMY_BODY = (month: string) => `(\\d{1,2})${ORD}\\.?\\s+(?:of\\s+)?(${month})\\.?,?\\s+(\\d{4})`;

const mdyText: DateFormat = {
  id: "mdy-text",
  label: "Oct 25, 2026",
  examples: ["Oct 25, 2026", "October 25, 2026", "Oct. 25 2026"],
  defaultEnabled: true,
  find(text, { tables }) {
    const re = tableRegex(tables, "mdy-text", () => `${LEFT_GUARD}${MDY_BODY(monthPattern(tables, ["en"]))}${RIGHT_GUARD}`);
    return scanRegex(re, text, (m) => {
      const month = englishMonth(tables, m[1]);
      return month && { index: m.index, length: m[0].length, y: int(m[3]), m: month.value, d: int(m[2]) };
    });
  },
};

const dmyText: DateFormat = {
  id: "dmy-text",
  label: "25 Oct 2026",
  examples: ["25 Oct 2026", "25 October 2026", "25th October 2026"],
  defaultEnabled: true,
  find(text, { tables }) {
    const re = tableRegex(tables, "dmy-text", () => `${LEFT_GUARD}${DMY_BODY(monthPattern(tables, ["en"]))}${RIGHT_GUARD}`);
    return scanRegex(re, text, (m) => {
      const month = englishMonth(tables, m[2]);
      return month && { index: m.index, length: m[0].length, y: int(m[3]), m: month.value, d: int(m[1]) };
    });
  },
};

const weekdayText: DateFormat = {
  id: "weekday-text",
  label: "Sun, 25 Oct 2026",
  examples: ["Sun, 25 Oct 2026", "Sunday, October 25, 2026"],
  defaultEnabled: true,
  find(text, { tables }) {
    const re = tableRegex(tables, "weekday-text", () => {
      const month = monthPattern(tables, ["en"]);
      return `${LEFT_GUARD}(${weekdayPattern(tables, ["en"])})\\.?,?\\s+(?:${DMY_BODY(month)}|${MDY_BODY(month)})${RIGHT_GUARD}`;
    });
    // Groups: 2-4 = d, month, y (day first); 5-7 = month, d, y (month first). The weekday is not checked against the date.
    return scanRegex(re, text, (m) => {
      const dayFirst = m[2] !== undefined;
      const month = englishMonth(tables, dayFirst ? m[3] : m[5]);
      if (!month) return null;
      return {
        index: m.index,
        length: m[0].length,
        y: int(dayFirst ? m[4] : m[7]),
        m: month.value,
        d: int(dayFirst ? m[2] : m[6]),
      };
    });
  },
};

const textNoYear: DateFormat = {
  id: "text-no-year",
  label: "Oct 25",
  examples: ["Oct 25", "25 Oct"],
  defaultEnabled: true,
  find(text, { tables, lang }) {
    const re = tableRegex(tables, "text-no-year", () => {
      const month = monthPattern(tables, ["en"]);
      return (
        `${LEFT_GUARD}(?:(${month})\\.?\\s+(\\d{1,2})${ORD}|(\\d{1,2})${ORD}\\s+(?:of\\s+)?(${month}))` +
        `${RIGHT_GUARD}(?!\\.?,?\\s*\\d{4})`
      );
    });
    return scanRegex(re, text, (m) => {
      const monthFirst = m[1] !== undefined;
      const month = englishMonth(tables, monthFirst ? m[1] : m[4]);
      if (!month || (month.short && !shortNameAllowedWithoutYear("en", lang))) return null;
      return { index: m.index, length: m[0].length, m: month.value, d: int(monthFirst ? m[2] : m[3]) };
    });
  },
};

const NUMERIC = new RegExp(`${LEFT_GUARD}(\\d{1,2})([./-])(\\d{1,2})\\2(\\d{4})${RIGHT_GUARD}`, "gu");

const dmyNumeric: DateFormat = {
  id: "dmy-numeric",
  label: "25/10/2026",
  examples: ["25/10/2026", "25.10.2026", "25-10-2026"],
  defaultEnabled: true,
  find: simple(NUMERIC, { d: 1, m: 3, y: 4 }),
};

const mdyNumeric: DateFormat = {
  id: "mdy-numeric",
  label: "10/25/2026",
  examples: ["10/25/2026"],
  defaultEnabled: false,
  find: simple(NUMERIC, { m: 1, d: 3, y: 4 }),
};

const ymdSlash: DateFormat = {
  id: "ymd-slash",
  label: "2026/10/25",
  examples: ["2026/10/25"],
  defaultEnabled: true,
  find: simple(new RegExp(`${LEFT_GUARD}(\\d{4})/(\\d{1,2})/(\\d{1,2})${RIGHT_GUARD}`, "gu"), { y: 1, m: 2, d: 3 }),
};

const SHORT_YEAR = new RegExp(`${LEFT_GUARD}(\\d{1,2})([./-])(\\d{1,2})\\2(\\d{2})${RIGHT_GUARD}`, "gu");

const numericShortYear: DateFormat = {
  id: "numeric-short-year",
  label: "25/10/26",
  examples: ["25/10/26"],
  defaultEnabled: false,
  find(text, { ambiguous }) {
    return scanRegex(SHORT_YEAR, text, (m) => {
      const [first, second] = [int(m[1]), int(m[3])];
      const dmy = ambiguous === "dmy";
      return { index: m.index, length: m[0].length, y: 2000 + int(m[4]), m: dmy ? second : first, d: dmy ? first : second };
    });
  },
};

const localizedMonths: DateFormat = {
  id: "localized-months",
  label: "25 de outubro de 2026",
  examples: ["25 de outubro de 2026", "25. Oktober 2026", "25 oct. 2026"],
  defaultEnabled: true,
  find(text, { tables, lang }) {
    const nonEnglish = tables.langs.filter((l) => l !== "en");
    if (nonEnglish.length === 0) return [];
    const re = tableRegex(
      tables,
      "localized-months",
      () =>
        `${LEFT_GUARD}(?:(${weekdayPattern(tables)})\\.?,?\\s+)?(\\d{1,2})\\.?(?:\\s+de)?\\s+(${monthPattern(tables, nonEnglish)})` +
        `(?:\\.?(?:\\s+de)?,?\\s+(\\d{4}))?${RIGHT_GUARD}`,
      "giud",
    );
    const page = baseLang(lang);
    const order = page && nonEnglish.includes(page) ? [page, ...nonEnglish.filter((l) => l !== page)] : nonEnglish;

    return scanRegex(re, text, (m) => {
      const [weekday, day, monthRaw, year] = [m[1], m[2]!, m[3]!, m[4]];
      const candidates = order.flatMap((l) => lookupMonths(tables, monthRaw, [l]));
      const usable = candidates.filter((c) => year !== undefined || !c.short || shortNameAllowedWithoutYear(c.lang, lang));
      // The whole date must read as one language; a mismatched weekday is dropped, not the date.
      const consistent = weekday === undefined ? undefined : usable.find((c) => lookupWeekdays(tables, weekday, [c.lang]).length > 0);
      const month = consistent ?? usable[0];
      if (!month) return null;
      const start = consistent || weekday === undefined ? m.index : m.indices![2]![0];
      return {
        index: start,
        length: m.index + m[0].length - start,
        y: year === undefined ? undefined : int(year),
        m: month.value,
        d: int(day),
      };
    });
  },
};

const CHRONO = { en, pt, de, fr, es, it };

/**
 * Absolute dates ("5 Mar, 12") belong to the other formats; `natural` keeps relative phrases only:
 * chrono's casual references and relative offsets, and bare weekdays. "now" is everywhere and is not a date.
 */
function isRelative(r: en.ParsedResult): boolean {
  const tags = [...r.tags()];
  if (tags.includes("casualReference/now")) return false;
  if (tags.some((t) => t.startsWith("casualReference/") || t === "result/relativeDate")) return true;
  return r.start.isCertain("weekday") && !r.start.isCertain("month");
}

const natural: DateFormat = {
  id: "natural",
  label: "tomorrow",
  examples: ["today", "tomorrow", "next Friday", "in 3 days"],
  defaultEnabled: false,
  find(text, { lang, today }) {
    const chrono = CHRONO[(baseLang(lang) ?? "en") as keyof typeof CHRONO] ?? en;
    const out: RawMatch[] = [];
    for (const r of chrono.casual.parse(text, today, { forwardDate: true })) {
      const d = r.start.get("day");
      const m = r.start.get("month");
      const y = r.start.get("year");
      if (d === null || m === null || y === null) continue;
      if (!isRelative(r) || touchesNeighbour(text, r.index, r.text.length)) continue;
      if (!isValidDate({ y, m, d })) continue;
      out.push({ index: r.index, length: r.text.length, y, m, d });
    }
    return out;
  },
};

export const BUILTIN_FORMATS: DateFormat[] = [
  iso,
  mdyText,
  dmyText,
  weekdayText,
  textNoYear,
  dmyNumeric,
  mdyNumeric,
  ymdSlash,
  numericShortYear,
  localizedMonths,
  natural,
];
