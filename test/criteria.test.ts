import { describe, expect, it } from "vitest";
import type { MatchContext } from "../src/core/context";
import { evaluateCriteria } from "../src/core/criteria";

const ctx = (parts: Partial<MatchContext>): MatchContext => ({ before: null, columnHeader: null, sectionHeading: null, snippet: "", ...parts });
const settings = (contextKeywords: string[] = [], ignoreKeywords: string[] = [], maxDistanceDays = 365) => ({
  contextKeywords,
  ignoreKeywords,
  maxDistanceDays,
});

describe("evaluateCriteria", () => {
  it("accepts everything when no keywords are set", () => {
    expect(evaluateCriteria(ctx({ before: "whatever " }), 3, settings())).toBeNull();
  });

  it.each<[string, Partial<MatchContext>]>([
    ["text before", { before: "The DEADLINE is " }],
    ["column header", { columnHeader: "Deadline" }],
    ["section heading", { sectionHeading: "Upcoming deadlines" }],
  ])("finds a context keyword in the %s", (_name, parts) => {
    expect(evaluateCriteria(ctx(parts), 3, settings(["deadline"]))).toBeNull();
  });

  it("rejects when a context keyword is required but absent", () => {
    expect(evaluateCriteria(ctx({ before: "Created " }), 3, settings(["due", " "]))).toBe("no-keyword");
  });

  it("ignore keywords win over context keywords", () => {
    expect(evaluateCriteria(ctx({ before: "Due, created " }), 3, settings(["due"], ["Created"]))).toBe("ignored");
  });

  it("rejects dates beyond the max distance either way", () => {
    expect(evaluateCriteria(ctx({}), 366, settings())).toBe("too-far");
    expect(evaluateCriteria(ctx({}), -366, settings())).toBe("too-far");
    expect(evaluateCriteria(ctx({}), -365, settings())).toBeNull();
  });
});
