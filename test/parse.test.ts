import { describe, expect, it, vi } from "vitest";
import { BUILTIN_FORMATS } from "../src/core/formats";
import { buildNameTables, resolveAmbiguous } from "../src/core/languages";
import { findDates } from "../src/core/parse";
import { withBrowserLocale } from "./helpers/intlLocale";

const LANGS = ["en", "pt", "de", "fr", "es", "it"];
const tables = buildNameTables(LANGS);
const today = new Date(2026, 10, 8, 12);
const formats = (...ids: string[]) => BUILTIN_FORMATS.filter((f) => ids.includes(f.id));
const ENABLED_BY_DEFAULT = BUILTIN_FORMATS.filter((f) => f.defaultEnabled);

const run = (text: string, fs = ENABLED_BY_DEFAULT, ambiguous: "dmy" | "mdy" = "dmy", lang: string | null = "en") =>
  findDates(text, fs, { lang, tables, ambiguous, today }).map((m) => ({ text: m.text, formatId: m.formatId, date: m.date }));

describe("overlaps", () => {
  it("keeps the longest match", () => {
    expect(run("Sun, 25 Oct 2026")).toEqual([{ text: "Sun, 25 Oct 2026", formatId: "weekday-text", date: { y: 2026, m: 10, d: 25 } }]);
    expect(run("25 Oct 2026")).toEqual([{ text: "25 Oct 2026", formatId: "dmy-text", date: { y: 2026, m: 10, d: 25 } }]);
    expect(run("Oct 25, 2026 and Nov 12")).toEqual([
      { text: "Oct 25, 2026", formatId: "mdy-text", date: { y: 2026, m: 10, d: 25 } },
      { text: "Nov 12", formatId: "text-no-year", date: { y: 2026, m: 11, d: 12 } },
    ]);
  });

  it("fills the nearest year and computes days until", () => {
    const [m] = findDates("Jan 3", ENABLED_BY_DEFAULT, { lang: "en", tables, ambiguous: "dmy", today });
    expect(m).toMatchObject({ date: { y: 2027, m: 1, d: 3 }, daysUntil: 56 });
  });
});

describe("ambiguous numeric dates", () => {
  const both = formats("dmy-numeric", "mdy-numeric");

  it("follow the explicit preference", () => {
    expect(run("03/04/2026", both, "dmy")[0]!.date).toEqual({ y: 2026, m: 4, d: 3 });
    expect(run("03/04/2026", both, "mdy")[0]!.date).toEqual({ y: 2026, m: 3, d: 4 });
  });

  it.each([
    ["en-US", { y: 2026, m: 3, d: 4 }],
    ["en-GB", { y: 2026, m: 4, d: 3 }],
    ["pt-PT", { y: 2026, m: 4, d: 3 }],
  ])("auto on %s", (lang, date) => {
    expect(run("03/04/2026", both, resolveAmbiguous("auto", lang), lang)).toEqual([expect.objectContaining({ date })]);
  });

  it("an unambiguous date is read by whichever format can", () => {
    expect(run("10/25/2026", both, "dmy")).toEqual([{ text: "10/25/2026", formatId: "mdy-numeric", date: { y: 2026, m: 10, d: 25 } }]);
    expect(run("10/25/2026", formats("dmy-numeric"))).toEqual([]);
  });
});

describe("browser locale independence", () => {
  const SAMPLE =
    "Due 2026-11-12, then 12/11/2026, Nov 12, 12 November 2026, Sun, 8 Nov 2026, 3 févr. 2026, 5 Mar, " +
    "12 out. 2026, 10/25/2026 and tomorrow. Student 72182780.";

  async function scanUnder(locale: string) {
    return withBrowserLocale(locale, async () => {
      // Fresh module instances so name tables and regexes are built under the mocked locale, not reused from cache.
      vi.resetModules();
      const languages = await import("../src/core/languages");
      const { BUILTIN_FORMATS: fresh } = await import("../src/core/formats");
      const { findDates: fd } = await import("../src/core/parse");
      const t = languages.buildNameTables(LANGS);
      return fd(SAMPLE, fresh, { lang: "en", tables: t, ambiguous: languages.resolveAmbiguous("auto", "en"), today });
    });
  }

  it("gives identical matches under pt-PT and en-US", async () => {
    const pt = await scanUnder("pt-PT");
    const us = await scanUnder("en-US");
    expect(new Intl.DateTimeFormat().resolvedOptions().locale).not.toBe("pt-PT");
    expect(pt).toEqual(us);
    expect(pt.map((m) => m.text)).toEqual([
      "2026-11-12",
      "12/11/2026",
      "Nov 12",
      "12 November 2026",
      "Sun, 8 Nov 2026",
      "3 févr. 2026",
      "5 Mar",
      "12 out. 2026",
      "10/25/2026",
      "tomorrow",
    ]);
  });

  it("the helper really changes the default locale", async () => {
    await withBrowserLocale("pt-PT", async () => {
      expect(new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(-28, "day")).toBe("há 28 dias");
      expect(navigator.language).toBe("pt-PT");
    });
  });
});
