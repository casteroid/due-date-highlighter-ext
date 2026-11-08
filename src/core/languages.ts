import type { AmbiguousNumeric } from "./types";

export type NameEntry = { value: number; lang: string; short: boolean; variants: string[] };
export type NameTables = { months: NameEntry[]; weekdays: NameEntry[]; langs: string[] };

export function baseLang(tag: string | null): string | null {
  if (tag === null) return null;
  return tag.trim().split(/[-_]/)[0]!.toLowerCase() || null;
}

const MDY_REGIONS = ["en-us", "en-ph"];

export function isMdyRegion(tag: string | null): boolean {
  return tag !== null && MDY_REGIONS.includes(tag.trim().replace("_", "-").toLowerCase());
}

export function resolveAmbiguous(pref: AmbiguousNumeric, pageLang: string | null): "dmy" | "mdy" {
  if (pref !== "auto") return pref;
  return isMdyRegion(pageLang) ? "mdy" : "dmy";
}

const stripMarks = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");

/** Lowercase, no trailing dot; the accent-free form is matched too. */
export function normaliseName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.$/, "");
}

function variants(name: string): string[] {
  const base = normaliseName(name);
  return [...new Set([base, stripMarks(base)])];
}

function format(lang: string, opts: Intl.DateTimeFormatOptions, date: number): string {
  return new Intl.DateTimeFormat(lang, { ...opts, timeZone: "UTC" }).format(new Date(date));
}

const cache = new Map<string, NameTables>();

/** Month and weekday names built from Intl for each language; English is always first. */
export function buildNameTables(requested: string[]): NameTables {
  const langs: string[] = [];
  for (const tag of ["en", ...requested]) {
    const lang = baseLang(tag);
    if (lang && !langs.includes(lang)) langs.push(lang);
  }
  const key = langs.join(",");
  const cached = cache.get(key);
  if (cached) return cached;

  const months: NameEntry[] = [];
  const weekdays: NameEntry[] = [];
  for (const lang of langs) {
    for (let i = 0; i < 12; i++) {
      const date = Date.UTC(2020, i, 1);
      const long = format(lang, { month: "long" }, date);
      const short = format(lang, { month: "short" }, date);
      months.push({ value: i + 1, lang, short: false, variants: variants(long) });
      if (normaliseName(short) !== normaliseName(long)) {
        months.push({ value: i + 1, lang, short: true, variants: variants(short) });
      }
    }
    // 2020-06-01 is a Monday; value 0 = Sunday.
    for (let i = 0; i < 7; i++) {
      const date = Date.UTC(2020, 5, i + 1);
      const value = (i + 1) % 7;
      const long = format(lang, { weekday: "long" }, date);
      const short = format(lang, { weekday: "short" }, date);
      weekdays.push({ value, lang, short: false, variants: variants(long) });
      if (normaliseName(short) !== normaliseName(long)) {
        weekdays.push({ value, lang, short: true, variants: variants(short) });
      }
    }
  }
  months.push({ value: 9, lang: "en", short: true, variants: ["sept"] });

  const tables = { months, weekdays, langs };
  cache.set(key, tables);
  return tables;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function namePattern(entries: NameEntry[], langs?: string[]): string {
  const all = new Set<string>();
  for (const e of entries) if (!langs || langs.includes(e.lang)) for (const v of e.variants) all.add(v);
  const sorted = [...all].sort((a, b) => b.length - a.length).map(escapeRegex);
  return `(?:${sorted.join("|")})`;
}

/** All entries whose variants contain `raw`, in table order (English first, then `langs` order). */
function lookupAll(entries: NameEntry[], raw: string, langs?: string[]): NameEntry[] {
  const name = normaliseName(raw);
  const plain = stripMarks(name);
  return entries.filter(
    (e) => (!langs || langs.includes(e.lang)) && (e.variants.includes(name) || e.variants.includes(plain)),
  );
}

export function monthPattern(tables: NameTables, langs?: string[]): string {
  return namePattern(tables.months, langs);
}

export function weekdayPattern(tables: NameTables, langs?: string[]): string {
  return namePattern(tables.weekdays, langs);
}

export function lookupMonths(tables: NameTables, raw: string, langs?: string[]): NameEntry[] {
  return lookupAll(tables.months, raw, langs);
}

export function lookupWeekdays(tables: NameTables, raw: string, langs?: string[]): NameEntry[] {
  return lookupAll(tables.weekdays, raw, langs);
}

/** Single best entry: full names beat abbreviations that happen to share the spelling. */
export function lookupMonth(tables: NameTables, raw: string, langs?: string[]): NameEntry | null {
  const found = lookupMonths(tables, raw, langs);
  return found.find((e) => !e.short) ?? found[0] ?? null;
}

/**
 * Known page language: only that language's abbreviations may appear without a year.
 * Unknown page language: only English abbreviations may.
 */
export function shortNameAllowedWithoutYear(entryLang: string, pageLang: string | null): boolean {
  return pageLang !== null ? baseLang(pageLang) === entryLang : entryLang === "en";
}

export function detectPageLanguage(doc: Document): string | null {
  const htmlLang = doc.documentElement.getAttribute("lang")?.trim();
  if (htmlLang) return htmlLang;
  const meta = doc.querySelector('meta[http-equiv="Content-Language" i]')?.getAttribute("content");
  const metaLang = meta?.split(",")[0]?.trim();
  return metaLang || null;
}

/** The nearest `lang` attribute wins; `<html>` is itself an ancestor, so it is the last resort before meta. */
export function languageForNode(node: Node, doc: Document): string | null {
  const start = node.parentElement ?? doc.documentElement;
  const lang = start.closest("[lang]")?.getAttribute("lang")?.trim();
  return lang || detectPageLanguage(doc);
}
