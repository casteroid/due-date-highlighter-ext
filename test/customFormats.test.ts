import { describe, expect, it } from "vitest";
import { buildRegistry, compileCustomFormat, testCustomFormat } from "../src/core/customFormats";
import type { DateFormat } from "../src/core/formats";
import { buildNameTables } from "../src/core/languages";

const tables = buildNameTables(["en", "pt"]);
const ctx = { lang: "en", tables, ambiguous: "dmy" as const, today: new Date(2026, 10, 8) };

describe("compileCustomFormat", () => {
  it("finds numeric dates with a year", () => {
    const f = compileCustomFormat({ id: "a", label: "Compact", pattern: "(?<y>\\d{4})(?<m>\\d{2})(?<d>\\d{2})" }, tables) as DateFormat;
    expect(f.id).toBe("custom:a");
    expect(f.find("build 20261110 ok", ctx)).toEqual([{ index: 6, length: 8, y: 2026, m: 11, d: 10 }]);
    expect(f.find("id 9920261110", ctx)).toEqual([]);
  });

  it("accepts month names in any table language", () => {
    const f = compileCustomFormat({ id: "b", label: "", pattern: "(?<d>\\d{1,2})/(?<m>[a-zç]+)/(?<y>\\d{2})" }, tables) as DateFormat;
    expect(f.label).toBe("(?<d>\\d{1,2})/(?<m>[a-zç]+)/(?<y>\\d{2})");
    expect(f.find("25/outubro/26", ctx)).toEqual([{ index: 0, length: 13, y: 2026, m: 10, d: 25 }]);
  });

  it("reports invalid patterns", () => {
    expect(compileCustomFormat({ id: "c", label: "", pattern: "(?<d>\\d" }, tables)).toMatchObject({
      error: expect.stringMatching(/^Invalid regex: /),
    });
    expect(compileCustomFormat({ id: "c", label: "", pattern: "(\\d{2})" }, tables)).toEqual({
      error: "Pattern needs named groups (?<d>…) and (?<m>…)",
    });
  });

  it("is appended to the registry only when it compiles", () => {
    const ids = buildRegistry(
      [
        { id: "ok", label: "ok", pattern: "(?<d>\\d\\d)~(?<m>\\d\\d)" },
        { id: "bad", label: "bad", pattern: "(" },
      ],
      tables,
    ).map((f) => f.id);
    expect(ids).toContain("custom:ok");
    expect(ids).not.toContain("custom:bad");
    expect(ids[0]).toBe("iso");
  });
});

describe("testCustomFormat", () => {
  it("explains each rejected hit", () => {
    const cf = { id: "t", label: "", pattern: "(?<d>\\d{2})-(?<m>\\w+)-(?<y>\\d{4})" };
    expect(testCustomFormat(cf, "08-11-2026, 31-02-2026, 40-11-2026, 08-foo-2026, x08-11-2026", tables)).toEqual({
      matches: [
        { text: "08-11-2026", date: { y: 2026, m: 11, d: 8 } },
        { text: "31-02-2026", date: null, reason: "impossible date" },
        { text: "40-11-2026", date: null, reason: "day/month out of range" },
        { text: "08-foo-2026", date: null, reason: "month name not recognised" },
        { text: "08-11-2026", date: null, reason: "touches another letter or digit" },
      ],
    });
  });

  it("returns the compile error", () => {
    expect(testCustomFormat({ id: "t", label: "", pattern: "[" }, "x", tables).error).toMatch(/^Invalid regex/);
  });
});
