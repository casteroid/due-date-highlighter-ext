import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, migrate, newId } from "../src/core/storage";

describe("migrate", () => {
  it("returns a copy of the defaults when nothing is stored", () => {
    const s = migrate(undefined);
    expect(s).toEqual(DEFAULT_SETTINGS);
    s.tierProfiles[0]!.name = "changed";
    expect(DEFAULT_SETTINGS.tierProfiles[0]!.name).toBe("Due dates");
  });

  it("merges partial criteria with the defaults", () => {
    const s = migrate({ schemaVersion: 1, criteria: { contextKeywords: ["due"], context: { sectionHeading: true } } });
    expect(s.criteria.contextKeywords).toEqual(["due"]);
    expect(s.criteria.contextChars).toBe(40);
    expect(s.criteria.context).toEqual({ before: true, columnHeader: true, sectionHeading: true });
    expect(s.tierProfiles).toEqual(DEFAULT_SETTINGS.tierProfiles);
  });
});

describe("newId", () => {
  it("produces distinct short ids", () => {
    const a = newId();
    expect(a).toHaveLength(8);
    expect(newId()).not.toBe(a);
  });
});
