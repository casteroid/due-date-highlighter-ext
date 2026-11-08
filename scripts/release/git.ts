import { execFileSync } from "node:child_process";
import type { Commit } from "./conventional.ts";

export function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** Commits reachable from the range, newest first. `range` is anything `git log` accepts. */
export function commitsIn(range: string): Commit[] {
  const raw = execFileSync("git", ["log", "--format=%H%x1f%B%x1e", range], { encoding: "utf8" });
  return raw
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha = "", message = ""] = entry.split("\x1f");
      return { sha, message };
    });
}

/** The newest `vX.Y.Z` tag reachable from HEAD, or null before the first release. */
export function lastReleaseTag(): string | null {
  try {
    return git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*.[0-9]*.[0-9]*", "HEAD");
  } catch {
    return null;
  }
}
