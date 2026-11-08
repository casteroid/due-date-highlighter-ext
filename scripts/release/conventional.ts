/** Conventional Commits parsing and the semver bump they imply. https://www.conventionalcommits.org/ */

export const COMMIT_TYPES = ["feat", "fix", "perf", "refactor", "docs", "test", "build", "ci", "chore", "style", "revert"] as const;
export type CommitType = (typeof COMMIT_TYPES)[number];
export type Bump = "major" | "minor" | "patch";

export type Commit = { sha: string; message: string };
export type ParsedCommit = { sha: string; type: CommitType; scope: string | null; breaking: boolean; subject: string };

const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[^()\s]+)\))?(?<bang>!)?: (?<subject>\S.*)$/;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE: \S/m;
/** Headers git writes itself; they are allowed and carry no version impact. */
const GIT_GENERATED = /^(Merge (branch|pull request|remote-tracking branch) |Revert ")/;

export function parseCommit({ sha, message }: Commit): ParsedCommit | null {
  const [header = "", ...rest] = message.trim().split("\n");
  const m = HEADER.exec(header.trim());
  const type = m?.groups?.type;
  if (!m?.groups || !type || !(COMMIT_TYPES as readonly string[]).includes(type)) return null;
  return {
    sha,
    type: type as CommitType,
    scope: m.groups.scope ?? null,
    breaking: m.groups.bang === "!" || BREAKING_FOOTER.test(rest.join("\n")),
    subject: m.groups.subject!.trim(),
  };
}

/** Why a commit message is not acceptable, or null when it is. */
export function lintCommit(commit: Commit): string | null {
  const header = commit.message.trim().split("\n")[0] ?? "";
  if (GIT_GENERATED.test(header)) return null;
  if (parseCommit(commit)) return null;
  return `"${header}" is not "<type>(<optional scope>)!: <subject>" with type one of ${COMMIT_TYPES.join(", ")}`;
}

/** Breaking change → major, feat → minor, fix or perf → patch; anything else does not release. */
export function bumpFor(commits: ParsedCommit[]): Bump | null {
  if (commits.some((c) => c.breaking)) return "major";
  if (commits.some((c) => c.type === "feat")) return "minor";
  if (commits.some((c) => c.type === "fix" || c.type === "perf")) return "patch";
  return null;
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function nextVersion(current: string, bump: Bump): string {
  const m = SEMVER.exec(current);
  if (!m) throw new Error(`Not a MAJOR.MINOR.PATCH version: ${current}`);
  const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const SECTIONS: { title: string; pick: (c: ParsedCommit) => boolean }[] = [
  { title: "Breaking changes", pick: (c) => c.breaking },
  { title: "Features", pick: (c) => !c.breaking && c.type === "feat" },
  { title: "Bug fixes", pick: (c) => !c.breaking && c.type === "fix" },
  { title: "Performance", pick: (c) => !c.breaking && c.type === "perf" },
];

/** Markdown release notes: user-visible changes only, newest first as given. */
export function releaseNotes(commits: ParsedCommit[]): string {
  const blocks: string[] = [];
  for (const { title, pick } of SECTIONS) {
    const lines = commits.filter(pick).map((c) => `- ${c.scope ? `**${c.scope}:** ` : ""}${c.subject} (${c.sha.slice(0, 7)})`);
    if (lines.length > 0) blocks.push(`### ${title}\n\n${lines.join("\n")}`);
  }
  return blocks.length > 0 ? `${blocks.join("\n\n")}\n` : "Maintenance release.\n";
}
