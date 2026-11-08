import { describe, expect, it, vi } from "vitest";
import { badgeLabel, daysUntil, isValidDate, resolveYear } from "../src/core/dates";

// Node re-reads TZ when it changes, so every Date below lives in a zone with DST.
vi.stubEnv("TZ", "Europe/Lisbon");

it("runs in Europe/Lisbon", () => {
  expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-60);
});

const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe("daysUntil", () => {
  it.each([
    ["across spring-forward DST", local(2026, 3, 28), { y: 2026, m: 3, d: 30 }, 2],
    ["across autumn DST", local(2026, 10, 24), { y: 2026, m: 10, d: 26 }, 2],
    ["back across autumn DST", local(2026, 10, 26, 0, 30), { y: 2026, m: 10, d: 24 }, -2],
    ["year boundary", local(2025, 12, 31), { y: 2026, m: 1, d: 1 }, 1],
    ["month boundary", local(2026, 2, 28), { y: 2026, m: 3, d: 1 }, 1],
    ["same day late evening", local(2026, 3, 29, 23, 59), { y: 2026, m: 3, d: 29 }, 0],
    ["yesterday just after midnight", local(2026, 3, 30, 0, 1), { y: 2026, m: 3, d: 29 }, -1],
  ])("%s", (_name, today, date, expected) => {
    expect(daysUntil(date, today)).toBe(expected);
  });
});

describe("resolveYear", () => {
  it("picks the nearest occurrence", () => {
    expect(resolveYear(1, 5, local(2026, 12, 20))).toEqual({ y: 2027, m: 1, d: 5 });
    expect(resolveYear(12, 20, local(2027, 1, 5))).toEqual({ y: 2026, m: 12, d: 20 });
    expect(resolveYear(11, 12, local(2026, 11, 8))).toEqual({ y: 2026, m: 11, d: 12 });
  });

  it("prefers the future on a tie", () => {
    // 2027-07-02 and 2028-07-02 are both 183 days from 2028-01-01 (the span contains Feb 29).
    expect(resolveYear(7, 2, local(2028, 1, 1))).toEqual({ y: 2028, m: 7, d: 2 });
  });

  it("skips invalid candidates", () => {
    expect(resolveYear(2, 29, local(2027, 1, 10))).toEqual({ y: 2028, m: 2, d: 29 });
  });
});

describe("isValidDate", () => {
  it("rejects impossible dates", () => {
    expect(isValidDate({ y: 2026, m: 2, d: 31 })).toBe(false);
    expect(isValidDate({ y: 2026, m: 13, d: 1 })).toBe(false);
    expect(isValidDate({ y: 2026, m: 0, d: 1 })).toBe(false);
    expect(isValidDate({ y: 2028, m: 2, d: 29 })).toBe(true);
  });
});

describe("badgeLabel", () => {
  it("formats both badge styles", () => {
    expect(badgeLabel(-3, "signed")).toBe("-3d");
    expect(badgeLabel(5, "signed")).toBe("+5d");
    expect(badgeLabel(-3, "ago")).toBe("3d ago");
    expect(badgeLabel(5, "ago")).toBe("in 5d");
    expect(badgeLabel(0, "ago")).toBe("today");
  });
});
