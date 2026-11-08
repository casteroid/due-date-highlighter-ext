import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/core/storage";
import { pickTier, tierRangeWarnings } from "../src/core/tiers";
import type { Tier, TierProfile } from "../src/core/types";

const due = DEFAULT_SETTINGS.tierProfiles[0]!;
const t = (id: string, minDays: number | null, maxDays: number | null, enabled = true): Tier => ({
  id,
  name: id,
  enabled,
  minDays,
  maxDays,
  bgColor: "#000000",
  textColor: "#ffffff",
  style: "background",
  showDaysBadge: false,
});

describe("pickTier", () => {
  it.each([
    [-400, "due-overdue"],
    [-1, "due-overdue"],
    [0, "due-today"],
    [3, "due-3d"],
    [4, "due-week"],
    [7, "due-week"],
    [8, null],
  ])("default due profile: %i days → %s", (days, expected) => {
    expect(pickTier(due, days)?.id ?? null).toBe(expected);
  });

  it("first enabled match wins and disabled tiers are skipped", () => {
    const profile: TierProfile = {
      id: "p",
      name: "p",
      badgeStyle: "signed",
      tiers: [t("off", null, null, false), t("wide", 0, 10), t("narrow", 2, 3)],
    };
    expect(pickTier(profile, 2)?.id).toBe("wide");
    expect(pickTier(profile, -1)).toBeNull();
  });
});

describe("tierRangeWarnings", () => {
  it("reports overlaps and gaps among enabled tiers", () => {
    const warnings = tierRangeWarnings([t("a", null, 0), t("b", 0, 3), t("c", 6, null), t("off", 4, 5, false)]);
    expect(warnings).toEqual(["Tier a and Tier b overlap on 0..0; the first match wins", "No tier covers 4..5"]);
  });

  it("is silent for the default due profile", () => {
    expect(tierRangeWarnings(due.tiers)).toEqual([]);
  });
});
