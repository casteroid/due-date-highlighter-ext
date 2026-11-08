// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  buildNameTables,
  detectPageLanguage,
  languageForNode,
  lookupMonth,
  resolveAmbiguous,
} from "../src/core/languages";

const tables = buildNameTables(["en", "pt", "de", "fr", "es", "it"]);

describe("buildNameTables", () => {
  it.each([
    ["out", "pt", 10],
    ["out.", "pt", 10],
    ["outubro", "pt", 10],
    ["Okt.", "de", 10],
    ["März", "de", 3],
    ["févr.", "fr", 2],
    ["fevr", "fr", 2],
    ["sept", "en", 9],
  ])("%s is a %s month (%i)", (raw, lang, value) => {
    expect(lookupMonth(tables, raw, [lang])?.value).toBe(value);
  });

  it("always includes English first", () => {
    expect(buildNameTables(["pt-BR"]).langs).toEqual(["en", "pt"]);
  });

  it("prefers a full name over an abbreviation spelled the same", () => {
    // "mai" is the Portuguese abbreviation of maio and the full French and German name.
    expect(lookupMonth(tables, "mai")).toMatchObject({ value: 5, short: false });
  });
});

describe("resolveAmbiguous", () => {
  it.each([
    ["en-US", "mdy"],
    ["en-us", "mdy"],
    ["en-GB", "dmy"],
    ["en", "dmy"],
    ["pt-PT", "dmy"],
    [null, "dmy"],
  ] as const)("auto on %s → %s", (lang, expected) => {
    expect(resolveAmbiguous("auto", lang)).toBe(expected);
  });

  it("explicit preference ignores the page language", () => {
    expect(resolveAmbiguous("dmy", "en-US")).toBe("dmy");
    expect(resolveAmbiguous("mdy", "pt-PT")).toBe("mdy");
  });
});

describe("page language", () => {
  const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

  it("reads <html lang>", () => {
    expect(detectPageLanguage(parse('<html lang="en-GB"><body>x</body></html>'))).toBe("en-GB");
  });

  it("falls back to the Content-Language meta", () => {
    const doc = parse('<html><head><meta http-equiv="content-language" content="pt-PT, en"></head><body>x</body></html>');
    expect(detectPageLanguage(doc)).toBe("pt-PT");
  });

  it("is unknown when nothing is set", () => {
    expect(detectPageLanguage(parse("<html><body>x</body></html>"))).toBeNull();
  });

  it("uses the nearest ancestor lang for a text node", () => {
    const doc = parse('<html lang="en"><body><p>a</p><section lang="pt"><p><b>b</b></p></section></body></html>');
    const [a, b] = [doc.querySelector("p")!.firstChild!, doc.querySelector("b")!.firstChild!];
    expect(languageForNode(a, doc)).toBe("en");
    expect(languageForNode(b, doc)).toBe("pt");
  });
});
