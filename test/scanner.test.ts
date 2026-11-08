// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildRegistry } from "../src/core/customFormats";
import { buildNameTables } from "../src/core/languages";
import { Scanner } from "../src/core/scanner";
import { resolveSettings } from "../src/core/settings";
import { DEFAULT_SETTINGS } from "../src/core/storage";
import type { Settings, SiteRule } from "../src/core/types";

const URL = "http://localhost:8080/fixture.html";
const today = () => new Date(2026, 10, 8, 9);

function scannerFor(rule: Partial<SiteRule> = {}, patch: Partial<Settings> = {}) {
  const settings: Settings = {
    ...structuredClone(DEFAULT_SETTINGS),
    siteRules: [{ id: "r", pattern: "localhost", enabled: true, ...rule }],
    ...patch,
  };
  const registry = buildRegistry(settings.customFormats, buildNameTables(settings.criteria.pageLanguages));
  return new Scanner({
    doc: document,
    registry,
    resolved: resolveSettings(settings, URL, registry)!,
    today,
    schedule: (run) => run({ timeRemaining: () => 50 }),
  });
}

function setup(body: string, lang = "en") {
  document.documentElement.setAttribute("lang", lang);
  document.head.innerHTML = "";
  document.body.innerHTML = body;
}

const spans = () => Array.from(document.querySelectorAll<HTMLElement>("span[data-ddh]"));

const QUEUE = `
  <h2>Assignments marked this week</h2>
  <table>
    <thead><tr><th>Student</th><th>Full name</th><th>Marked</th><th>Assignment</th></tr></thead>
    <tbody><tr><td>72182781</td><td>Bea Lopes</td><td>Nov 2, 2026</td><td>Essay 1</td></tr></tbody>
  </table>
  <h2>Assignments uploaded but not yet marked</h2>
  <table>
    <thead><tr><th>Student</th><th>Full name</th><th>Uploaded</th><th>Assignment</th><th>Type</th><th>Course</th><th>Action</th></tr></thead>
    <tbody>
      <tr><td>72182780</td><td>Ana Silva</td><td>Oct 11, 2026</td><td>Essay 2</td><td>File</td><td>HIST101</td><td>Grade</td></tr>
      <tr><td>20261025</td><td>Rui Costa</td><td>Oct 31, 2026</td><td>Essay 2</td><td>File</td><td>HIST101</td><td>Grade</td></tr>
      <tr><td>72182799</td><td>Eva Mota</td><td>Nov 6, 2026</td><td>Essay 2</td><td>File</td><td>HIST101</td><td>Grade</td></tr>
    </tbody>
  </table>`;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Scanner", () => {
  it("wraps a date with its tier, style, format and badge", async () => {
    setup("<p>Due: 2026-11-12 please</p>");
    await scannerFor().scan();
    const [span] = spans();
    expect(span).toBeDefined();
    expect(span!.textContent).toBe("2026-11-12");
    expect(span!.dataset).toMatchObject({ ddh: "1", ddhId: "iso|2026-11-12#0", ddhTier: "due-week", ddhFormat: "iso", ddhBadge: "+4d" });
    expect(span!.className).toBe("ddh-background");
    expect(span!.style.getPropertyValue("--ddh-bg")).toBe("#fef08a");
    expect(span!.title).toBe("This week · in 4 days · 2026-10-25");
    expect(document.querySelectorAll("style[data-ddh]")).toHaveLength(1);
  });

  it("restores the page exactly after unwrapping", async () => {
    setup("<p>Due: 2026-11-12, then <b>Nov 12</b> and 12/11/2026 and 2026-11-10.</p><p>Created: 2026-10-01</p>");
    const html = document.documentElement.outerHTML;
    const text = document.body.textContent;
    const scanner = scannerFor();
    await scanner.scan();
    expect(spans().length).toBe(5);
    expect(document.body.textContent).toBe(text);
    scanner.unwrapAll();
    expect(spans()).toHaveLength(0);
    expect(document.body.textContent).toBe(text);
    expect(document.documentElement.outerHTML).toBe(html);
    expect(document.body.firstChild!.childNodes).toHaveLength(3);
  });

  it("reports matches from switched-off formats without highlighting them", async () => {
    setup("<p>Ship 10/25/2026 or 2026-11-12</p>");
    const scanner = scannerFor();
    await scanner.scan();
    expect(scanner.getMatches()).toEqual([
      { id: "mdy-numeric|10/25/2026#0", text: "10/25/2026", daysUntil: -14, tierId: null, formatId: "mdy-numeric", context: "Ship 10/25/2026 or 2026-11-12", status: "format-off" },
      { id: "iso|2026-11-12#0", text: "2026-11-12", daysUntil: 4, tierId: "due-week", formatId: "iso", context: "… 10/25/2026 or 2026-11-12", status: "highlighted" },
    ]);
    expect(spans().map((s) => s.textContent)).toEqual(["2026-11-12"]);
  });

  it("skips code, inputs and editable areas", async () => {
    setup('<code>2026-11-12</code><pre>2026-11-12</pre><div contenteditable="true">2026-11-12</div><textarea>2026-11-12</textarea>');
    const scanner = scannerFor();
    await scanner.scan();
    expect(scanner.getMatches()).toEqual([]);
  });

  it("parses a Portuguese section by its own lang", async () => {
    setup('<p>Nov 12</p><section lang="pt"><p>Até 12 out. 2026 e 5 out; vamos set a mesa e ver o mar.</p></section>');
    const scanner = scannerFor({ formats: { "due-later": true } });
    await scanner.scan();
    expect(scanner.getMatches().map((m) => [m.text, m.formatId])).toEqual([
      ["Nov 12", "text-no-year"],
      ["12 out. 2026", "localized-months"],
      ["5 out", "localized-months"],
    ]);
  });

  it("highlights only the Uploaded column of the marking queue", async () => {
    setup(QUEUE);
    const scanner = scannerFor({
      tierProfileId: "waiting",
      contextKeywords: ["uploaded"],
      context: { sectionHeading: true },
    });
    await scanner.scan();
    expect(spans().map((s) => [s.textContent, s.dataset.ddhTier, s.dataset.ddhBadge, s.closest("td")!.cellIndex])).toEqual([
      ["Oct 11, 2026", "wait-15", "28d ago", 2],
      ["Oct 31, 2026", "wait-8-14", "8d ago", 2],
    ]);
    const matches = scanner.getMatches();
    expect(matches.map((m) => [m.text, m.status, m.reason])).toEqual([
      ["Nov 2, 2026", "filtered", "no-keyword"],
      ["Oct 11, 2026", "highlighted", undefined],
      ["Oct 31, 2026", "highlighted", undefined],
      ["Nov 6, 2026", "no-tier", undefined],
    ]);
  });

  it("flashes a focused match", async () => {
    vi.useFakeTimers();
    setup("<p>Due 2026-11-12</p>");
    const scanner = scannerFor();
    await scanner.scan();
    expect(scanner.focus("iso|2026-11-12#0")).toBe(true);
    const [span] = spans();
    expect(span!.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    expect(span!.classList.contains("ddh-flash")).toBe(true);
    vi.advanceTimersByTime(1100);
    expect(span!.classList.contains("ddh-flash")).toBe(false);
    expect(scanner.focus("nope")).toBe(false);
  });

  it("scans content added later, but not its own spans", async () => {
    vi.useFakeTimers();
    setup("<p>Due 2026-11-12</p>");
    const onScanComplete = vi.fn();
    const scanner = scannerFor();
    scanner.setDeps({ onScanComplete });
    await scanner.scan();
    scanner.observe();
    const p = document.createElement("p");
    p.textContent = "Delayed: due 2026-11-15 and Nov 20";
    document.body.append(p);
    await vi.advanceTimersByTimeAsync(299);
    expect(spans()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    // Nov 20 is 12 days out: the "Later" tier is off by default, so it is recorded but not wrapped.
    expect(spans().map((s) => s.textContent)).toEqual(["2026-11-12", "2026-11-15"]);
    expect(scanner.getMatches().map((m) => [m.id, m.status])).toEqual([
      ["iso|2026-11-12#0", "highlighted"],
      ["iso|2026-11-15#0", "highlighted"],
      ["text-no-year|Nov 20#0", "no-tier"],
    ]);
    // Wrapping the new date must not trigger another scan.
    await vi.advanceTimersByTimeAsync(1000);
    expect(onScanComplete).toHaveBeenCalledTimes(2);
    scanner.disconnect();
  });
});
