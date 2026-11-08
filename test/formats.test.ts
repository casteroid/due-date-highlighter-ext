import { describe, expect, it } from "vitest";
import { BUILTIN_FORMATS, type FindContext } from "../src/core/formats";
import { buildNameTables } from "../src/core/languages";

const tables = buildNameTables(["en", "pt", "de", "fr", "es", "it"]);
const today = new Date(2026, 10, 8, 12);
const ctx = (lang: string | null = "en", ambiguous: "dmy" | "mdy" = "dmy"): FindContext => ({ lang, tables, ambiguous, today });

function find(id: string, text: string, lang: string | null = "en", ambiguous: "dmy" | "mdy" = "dmy") {
  const format = BUILTIN_FORMATS.find((f) => f.id === id)!;
  return format.find(text, ctx(lang, ambiguous)).map((m) => ({
    text: text.slice(m.index, m.index + m.length),
    y: m.y,
    m: m.m,
    d: m.d,
  }));
}

type Positive = [id: string, text: string, matched: string, date: { y?: number; m: number; d: number }, lang?: string | null];

describe("positive cases", () => {
  it.each<Positive>([
    ["iso", "Due 2026-10-25.", "2026-10-25", { y: 2026, m: 10, d: 25 }],
    ["iso", "at 2026-10-25T14:30 sharp", "2026-10-25T14:30", { y: 2026, m: 10, d: 25 }],
    ["iso", "(2026-10-25T14:30:05.123+01:00)", "2026-10-25T14:30:05.123+01:00", { y: 2026, m: 10, d: 25 }],
    ["mdy-text", "on Oct 25, 2026.", "Oct 25, 2026", { y: 2026, m: 10, d: 25 }],
    ["mdy-text", "October 25, 2026", "October 25, 2026", { y: 2026, m: 10, d: 25 }],
    ["mdy-text", "Oct. 25 2026", "Oct. 25 2026", { y: 2026, m: 10, d: 25 }],
    ["mdy-text", "Sept 3rd, 2026", "Sept 3rd, 2026", { y: 2026, m: 9, d: 3 }],
    ["dmy-text", "25 Oct 2026", "25 Oct 2026", { y: 2026, m: 10, d: 25 }],
    ["dmy-text", "25th October 2026", "25th October 2026", { y: 2026, m: 10, d: 25 }],
    ["dmy-text", "1st of May, 2026", "1st of May, 2026", { y: 2026, m: 5, d: 1 }],
    ["dmy-text", "5 mar 2026", "5 mar 2026", { y: 2026, m: 3, d: 5 }],
    ["weekday-text", "Sun, 25 Oct 2026", "Sun, 25 Oct 2026", { y: 2026, m: 10, d: 25 }],
    ["weekday-text", "Sunday, October 25, 2026", "Sunday, October 25, 2026", { y: 2026, m: 10, d: 25 }],
    ["text-no-year", "Due Nov 12!", "Nov 12", { m: 11, d: 12 }],
    ["text-no-year", "by 25 Oct.", "25 Oct", { m: 10, d: 25 }],
    ["text-no-year", "Nov 12", "Nov 12", { m: 11, d: 12 }, null],
    ["dmy-numeric", "25/10/2026", "25/10/2026", { y: 2026, m: 10, d: 25 }],
    ["dmy-numeric", "25.10.2026", "25.10.2026", { y: 2026, m: 10, d: 25 }],
    ["dmy-numeric", "25-10-2026", "25-10-2026", { y: 2026, m: 10, d: 25 }],
    ["mdy-numeric", "10/25/2026", "10/25/2026", { y: 2026, m: 10, d: 25 }],
    ["ymd-slash", "2026/10/25", "2026/10/25", { y: 2026, m: 10, d: 25 }],
    ["localized-months", "25 de outubro de 2026", "25 de outubro de 2026", { y: 2026, m: 10, d: 25 }, "pt"],
    ["localized-months", "25 de outubro de 2026", "25 de outubro de 2026", { y: 2026, m: 10, d: 25 }, null],
    ["localized-months", "25. Oktober 2026", "25. Oktober 2026", { y: 2026, m: 10, d: 25 }, "de"],
    ["localized-months", "25. Okt. 2026", "25. Okt. 2026", { y: 2026, m: 10, d: 25 }, "en"],
    ["localized-months", "25 oct. 2026", "25 oct. 2026", { y: 2026, m: 10, d: 25 }, "fr"],
    ["localized-months", "3 févr. 2026", "3 févr. 2026", { y: 2026, m: 2, d: 3 }, "fr"],
    ["localized-months", "3 fevr 2026", "3 fevr 2026", { y: 2026, m: 2, d: 3 }, null],
    ["localized-months", "domingo, 25 de outubro de 2026", "domingo, 25 de outubro de 2026", { y: 2026, m: 10, d: 25 }, "pt"],
    ["localized-months", "Sunday, 25 de outubro de 2026", "25 de outubro de 2026", { y: 2026, m: 10, d: 25 }, "pt"],
    ["localized-months", "12 out. 2026", "12 out. 2026", { y: 2026, m: 10, d: 12 }, "pt"],
    ["localized-months", "até 12 out", "12 out", { m: 10, d: 12 }, "pt-PT"],
    ["localized-months", "5 mar", "5 mar", { m: 3, d: 5 }, "de"],
    ["localized-months", "5 set 2026", "5 set 2026", { y: 2026, m: 9, d: 5 }, "en"],
    ["localized-months", "8 maggio", "8 maggio", { m: 5, d: 8 }, "en"],
  ])("%s: %j", (id, text, matched, date, lang = "en") => {
    expect(find(id, text, lang)).toEqual([{ text: matched, y: date.y, m: date.m, d: date.d }]);
  });

  it("numeric-short-year follows the ambiguity preference", () => {
    expect(find("numeric-short-year", "03/04/26", "en", "dmy")).toEqual([{ text: "03/04/26", y: 2026, m: 4, d: 3 }]);
    expect(find("numeric-short-year", "03/04/26", "en", "mdy")).toEqual([{ text: "03/04/26", y: 2026, m: 3, d: 4 }]);
  });
});

describe("negative cases", () => {
  const ALL = BUILTIN_FORMATS.map((f) => f.id);
  it.each<[string, string | null]>([
    ["Student 72182780", "en"],
    ["ref 2026102512", "en"],
    ["abc2026-10-25x", "en"],
    ["xOct 25, 2026", "en"],
    ["31/02/2026", "en"],
    ["2026-13-01", "en"],
    ["2026-02-30", "en"],
    ["31 Feb 2026", "en"],
    ["Vamos set a mesa e ver o mar; ago é só uma palavra. Saímos out.", "pt"],
    ["5 set", "en"],
    ["5 out", "en"],
    ["5 out", null],
    ["2 ago", "en"],
    ["v1.2.3", "en"],
    ["Mar 5 is fine but Mar5 and 5Mar are not", "fr"],
  ])("%j (lang %s) produces nothing", (text, lang) => {
    for (const id of ALL.filter((i) => i !== "natural")) expect(find(id, text, lang), id).toEqual([]);
  });

  it("dmy-numeric does not read month-first dates", () => {
    expect(find("dmy-numeric", "10/25/2026")).toEqual([]);
  });

  it("text-no-year leaves dates with a year to other formats", () => {
    expect(find("text-no-year", "Oct 25, 2026")).toEqual([]);
    expect(find("text-no-year", "25 Oct 2026")).toEqual([]);
  });
});

describe("natural", () => {
  it("parses English relative words on an English page", () => {
    expect(find("natural", "Submit by tomorrow please", "en")).toEqual([{ text: "tomorrow", y: 2026, m: 11, d: 9 }]);
  });

  it("uses the page language parser", () => {
    expect(find("natural", "Entregar amanhã", "pt-PT")).toEqual([{ text: "amanhã", y: 2026, m: 11, d: 9 }]);
  });

  it("finds weekdays and offsets", () => {
    expect(find("natural", "next Friday or in 3 days", "en")).toEqual([
      { text: "next Friday", y: 2026, m: 11, d: 13 },
      { text: "in 3 days", y: 2026, m: 11, d: 11 },
    ]);
  });

  it("leaves absolute dates to other formats and ignores 'now'", () => {
    expect(find("natural", "2026-11-12, 12/11/2026, 5 Mar, 12 and Oct 25. Buy now.", "en")).toEqual([]);
  });
});
