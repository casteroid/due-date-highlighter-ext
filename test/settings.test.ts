import { describe, expect, it } from "vitest";
import { BUILTIN_FORMATS } from "../src/core/formats";
import { resolveSettings } from "../src/core/settings";
import { DEFAULT_SETTINGS } from "../src/core/storage";
import type { Settings } from "../src/core/types";

function settings(patch: Partial<Settings>): Settings {
  return { ...structuredClone(DEFAULT_SETTINGS), ...patch };
}

describe("resolveSettings", () => {
  it("returns null when no enabled rule matches", () => {
    const s = settings({ siteRules: [{ id: "r", pattern: "example.com", enabled: false }] });
    expect(resolveSettings(s, "https://example.com/", BUILTIN_FORMATS)).toBeNull();
  });

  it("uses global values when the rule does not override them", () => {
    const s = settings({ siteRules: [{ id: "r", pattern: "example.com", enabled: true }], formats: { iso: false } });
    const r = resolveSettings(s, "https://example.com/", BUILTIN_FORMATS)!;
    expect(r.profile.id).toBe("due");
    expect(r.formatsEnabled).toMatchObject({ iso: false, "dmy-numeric": true, "mdy-numeric": false, natural: false });
    expect(Object.keys(r.formatsEnabled)).toHaveLength(BUILTIN_FORMATS.length);
    expect(r.contextKeywords).toEqual([]);
    expect(r.context).toEqual(DEFAULT_SETTINGS.criteria.context);
  });

  it("lets the rule's format, keyword, language and context overrides beat the global settings", () => {
    const s = settings({
      formats: { iso: false, "mdy-numeric": false },
      criteria: { ...DEFAULT_SETTINGS.criteria, contextKeywords: ["due"], ignoreKeywords: ["created"] },
      siteRules: [
        {
          id: "r",
          pattern: "localhost",
          enabled: true,
          tierProfileId: "waiting",
          formats: { iso: true, "mdy-numeric": true, "dmy-text": false },
          contextKeywords: ["uploaded"],
          ignoreKeywords: [],
          pageLanguages: ["en"],
          ambiguousNumeric: "mdy",
          context: { sectionHeading: true, before: false },
        },
      ],
    });
    const r = resolveSettings(s, "http://localhost:8080/fixture.html", BUILTIN_FORMATS)!;
    expect(r.profile.id).toBe("waiting");
    expect(r.formatsEnabled).toMatchObject({ iso: true, "mdy-numeric": true, "dmy-text": false, "mdy-text": true });
    expect(r.contextKeywords).toEqual(["uploaded"]);
    expect(r.ignoreKeywords).toEqual([]);
    expect(r.pageLanguages).toEqual(["en"]);
    expect(r.ambiguousNumeric).toBe("mdy");
    expect(r.context).toEqual({ before: false, columnHeader: true, sectionHeading: true });
  });

  it("applies the most specific rule only", () => {
    const s = settings({
      siteRules: [
        { id: "site", pattern: "github.com", enabled: true, contextKeywords: ["site"] },
        { id: "page", pattern: "https://github.com/myorg/*", enabled: true, contextKeywords: ["org"] },
      ],
    });
    expect(resolveSettings(s, "https://github.com/myorg/x", BUILTIN_FORMATS)!.contextKeywords).toEqual(["org"]);
    expect(resolveSettings(s, "https://github.com/x", BUILTIN_FORMATS)!.contextKeywords).toEqual(["site"]);
  });

  it("falls back to the default profile when the rule names a deleted one", () => {
    const s = settings({ defaultProfileId: "waiting", siteRules: [{ id: "r", pattern: "a.com", enabled: true, tierProfileId: "gone" }] });
    expect(resolveSettings(s, "https://a.com/", BUILTIN_FORMATS)!.profile.id).toBe("waiting");
  });
});
