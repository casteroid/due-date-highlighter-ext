import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import {
  bumpFor,
  lintCommit,
  nextVersion,
  parseCommit,
  releaseNotes,
  type ParsedCommit,
} from "../scripts/release/conventional";
import manifest from "../src/manifest.json";

const commit = (message: string, sha = "abcdef1234567890") => ({ sha, message });
const parsed = (...messages: string[]) =>
  messages.map((m, i) => parseCommit(commit(m, `${i}`.padEnd(40, "0")))).filter((c): c is ParsedCommit => c !== null);

describe("parseCommit", () => {
  it.each([
    ["feat: add tiers", { type: "feat", scope: null, breaking: false, subject: "add tiers" }],
    ["fix(popup): keep focus", { type: "fix", scope: "popup", breaking: false, subject: "keep focus" }],
    ["feat(storage)!: drop schema 0", { type: "feat", scope: "storage", breaking: true, subject: "drop schema 0" }],
    ["refactor: split scanner\n\nBREAKING CHANGE: Scanner.scan returns void", { type: "refactor", breaking: true }],
    ["chore: tidy\n\nBREAKING-CHANGE: renamed setting", { type: "chore", breaking: true }],
  ])("%j", (message, expected) => {
    expect(parseCommit(commit(message))).toMatchObject(expected);
  });

  it.each(["Add tiers", "feature: add tiers", "feat:add tiers", "feat: ", "Feat: add tiers", "feat(a b): x"])(
    "rejects %j",
    (message) => {
      expect(parseCommit(commit(message))).toBeNull();
    },
  );

  it("does not treat BREAKING CHANGE in the subject as a footer", () => {
    expect(parseCommit(commit("docs: explain BREAKING CHANGE: footers"))?.breaking).toBe(false);
  });
});

describe("lintCommit", () => {
  it("accepts merge and revert commits git writes itself", () => {
    expect(lintCommit(commit("Merge pull request #3 from x/y"))).toBeNull();
    expect(lintCommit(commit('Revert "feat: add tiers"'))).toBeNull();
  });

  it("explains a bad header", () => {
    expect(lintCommit(commit("Add tiers\n\nbody"))).toMatch(/^"Add tiers" is not/);
  });
});

describe("bumpFor", () => {
  it.each<[string[], string | null]>([
    [["docs: readme", "chore: deps", "ci: cache"], null],
    [["docs: readme", "fix: crash"], "patch"],
    [["perf: faster scan"], "patch"],
    [["fix: crash", "feat: popup filter"], "minor"],
    [["feat: popup filter", "fix!: rename message type"], "major"],
    [["chore: x\n\nBREAKING CHANGE: y"], "major"],
  ])("%j → %s", (messages, bump) => {
    expect(bumpFor(parsed(...messages))).toBe(bump);
  });
});

describe("nextVersion", () => {
  it.each([
    ["0.1.0", "patch", "0.1.1"],
    ["0.1.9", "minor", "0.2.0"],
    ["0.9.3", "major", "1.0.0"],
    ["1.2.3", "minor", "1.3.0"],
  ] as const)("%s + %s → %s", (current, bump, next) => {
    expect(nextVersion(current, bump)).toBe(next);
  });

  it("refuses versions it cannot bump", () => {
    expect(() => nextVersion("1.2", "patch")).toThrow(/MAJOR.MINOR.PATCH/);
  });
});

describe("releaseNotes", () => {
  it("lists only user-visible changes, grouped", () => {
    const notes = releaseNotes(parsed("feat(popup): tier filter", "fix: midnight rescan", "docs: readme", "feat!: new storage key"));
    expect(notes).toBe(
      "### Breaking changes\n\n- new storage key (3000000)\n\n" +
        "### Features\n\n- **popup:** tier filter (0000000)\n\n" +
        "### Bug fixes\n\n- midnight rescan (1000000)\n",
    );
  });

  it("says so when nothing user-visible changed", () => {
    expect(releaseNotes(parsed("chore: deps"))).toBe("Maintenance release.\n");
  });
});

it("package.json and the manifest carry the same version", () => {
  expect(pkg.version).toBe(manifest.version);
});
