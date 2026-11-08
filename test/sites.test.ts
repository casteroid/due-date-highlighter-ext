import { describe, expect, it } from "vitest";
import { findMatchingRule, matchesPattern, originCovers, toMatchPattern, toOrigin } from "../src/core/sites";
import type { SiteRule } from "../src/core/types";

describe("matchesPattern", () => {
  it.each<[string, string, boolean]>([
    ["example.com", "https://example.com/a?b=1", true],
    ["example.com", "http://example.com:8080/", true],
    ["example.com", "https://www.example.com/", false],
    ["example.com", "https://notexample.com/", false],
    ["Example.COM", "https://example.com/", true],
    ["*.atlassian.net", "https://atlassian.net/", true],
    ["*.atlassian.net", "https://acme.atlassian.net/jira", true],
    ["*.atlassian.net", "https://a.b.atlassian.net/", true],
    ["*.atlassian.net", "https://atlassian.net.evil.com/", false],
    ["*.atlassian.net", "https://evilatlassian.net/", false],
    ["localhost:8080", "http://localhost:8080/fixture.html", true],
    ["localhost:8080", "http://localhost:9090/fixture.html", false],
    ["localhost", "http://localhost:8080/fixture.html", true],
    ["https://github.com/myorg/*/issues*", "https://github.com/myorg/repo/issues/12?tab=1#x", true],
    ["https://github.com/myorg/*/issues*", "https://github.com/myorg/repo/pulls", false],
    ["https://github.com/myorg/*/issues*", "https://github.com/other/repo/issues", false],
    ["https://github.com/myorg/*/issues*", "http://github.com/myorg/repo/issues", false],
    ["*://github.com/myorg/*", "http://github.com/myorg/x", true],
    ["http://localhost:8080/fixture.html", "http://localhost:8080/fixture.html?x=1#top", true],
    ["http://localhost:8080/fixture.html", "http://localhost:8080/other.html", false],
    ["https://a.com/page?x=1", "https://a.com/page?x=1", false],
    ["example.com", "not a url", false],
  ])("%s vs %s → %s", (pattern, url, expected) => {
    expect(matchesPattern(pattern, url)).toBe(expected);
  });
});

describe("findMatchingRule", () => {
  const rule = (id: string, pattern: string, enabled = true): SiteRule => ({ id, pattern, enabled });

  it("picks the most specific enabled rule", () => {
    const rules = [rule("site", "github.com"), rule("org", "https://github.com/myorg/*"), rule("off", "https://github.com/myorg/repo/*", false)];
    expect(findMatchingRule(rules, "https://github.com/myorg/repo/issues")?.id).toBe("org");
    expect(findMatchingRule(rules, "https://github.com/else")?.id).toBe("site");
    expect(findMatchingRule(rules, "https://gitlab.com/")).toBeUndefined();
  });

  it("breaks ties by list order", () => {
    expect(findMatchingRule([rule("a", "*.a.com"), rule("b", "a.com*")], "https://a.com/")?.id).toBe("a");
  });
});

describe("toMatchPattern / toOrigin", () => {
  it.each<[string, string | null, string | null]>([
    ["example.com", "*://example.com/*", "*://example.com/*"],
    ["*.atlassian.net", "*://*.atlassian.net/*", "*://*.atlassian.net/*"],
    ["localhost:8080", "*://localhost:8080/*", "*://localhost:8080/*"],
    ["http://localhost:8080/test/fixture.html", "http://localhost:8080/test/fixture.html*", "http://localhost:8080/*"],
    ["http://localhost:8080/test/fixture.html*", "http://localhost:8080/test/fixture.html*", "http://localhost:8080/*"],
    ["https://github.com/myorg/*/issues*", "https://github.com/myorg/*/issues*", "https://github.com/*"],
    ["*://*.example.com", "*://*.example.com/*", "*://*.example.com/*"],
    ["foo*.example.com", null, null],
    ["https://foo*.example.com/", null, null],
    ["ftp://example.com/", null, null],
    ["*", null, null],
    ["", null, null],
  ])("%s", (pattern, match, origin) => {
    expect(toMatchPattern(pattern)).toBe(match);
    expect(toOrigin(pattern)).toBe(origin);
  });
});

describe("originCovers", () => {
  it.each<[string, string, boolean]>([
    ["*://example.com/*", "*://example.com/*", true],
    ["*://example.com/*", "https://example.com/*", true],
    ["https://example.com/*", "*://example.com/*", false],
    ["*://localhost/*", "http://localhost:8080/*", true],
    ["http://localhost:8080/*", "http://localhost:9090/*", false],
    ["*://*.atlassian.net/*", "*://acme.atlassian.net/*", true],
    ["*://*.atlassian.net/*", "*://atlassian.net/*", true],
    ["*://acme.atlassian.net/*", "*://*.atlassian.net/*", false],
    ["<all_urls>", "https://anything.org/*", true],
    ["*://example.com/*", "*://example.org/*", false],
  ])("%s covers %s → %s", (granted, needed, expected) => {
    expect(originCovers(granted, needed)).toBe(expected);
  });
});
