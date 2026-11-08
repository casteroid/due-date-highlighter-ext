/**
 * Works out the next release from Conventional Commits since the last `v*` tag.
 *
 *   node scripts/release/plan.ts [--bump auto|patch|minor|major] [--notes-file FILE] [--apply]
 *
 * Prints the plan; with --apply writes the version into src/manifest.json, package.json and package-lock.json.
 * Inside GitHub Actions it also writes `version`, `tag` and `previous_tag` to $GITHUB_OUTPUT.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { bumpFor, nextVersion, parseCommit, releaseNotes, type Bump, type ParsedCommit } from "./conventional.ts";
import { commitsIn, lastReleaseTag } from "./git.ts";

const MANIFEST = "src/manifest.json";
const BUMPS = ["auto", "patch", "minor", "major"] as const;

const { values } = parseArgs({
  options: {
    bump: { type: "string", default: "auto" },
    "notes-file": { type: "string" },
    apply: { type: "boolean", default: false },
  },
});
const requested = BUMPS.find((b) => b === values.bump);
if (!requested) fail(`--bump must be one of ${BUMPS.join(", ")}`);

const current = manifestVersion();
const previousTag = lastReleaseTag();
if (previousTag && previousTag !== `v${current}`) {
  fail(`${MANIFEST} says ${current} but the last release tag is ${previousTag}; fix the version before releasing.`);
}

const commits: ParsedCommit[] = commitsIn(previousTag ? `${previousTag}..HEAD` : "HEAD")
  .map(parseCommit)
  .filter((c): c is ParsedCommit => c !== null);

let version: string;
if (!previousTag) {
  // First release: ship the version already in the manifest unless a bump is forced.
  version = requested === "auto" ? current : nextVersion(current, requested);
} else {
  const bump: Bump | null = requested === "auto" ? bumpFor(commits) : requested;
  if (!bump) {
    fail(`No feat, fix, perf or breaking commits since ${previousTag}, so there is nothing to release. Choose a bump to force one.`);
  }
  version = nextVersion(current, bump);
}

const tag = `v${version}`;
const notes = releaseNotes(commits);
console.log(`Previous release: ${previousTag ?? "none"}\nNext release:     ${tag} (${requested})\n\n${notes}`);

if (values["notes-file"]) writeFileSync(values["notes-file"], notes);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\ntag=${tag}\nprevious_tag=${previousTag ?? ""}\n`);
}

if (values.apply && version !== current) {
  const manifest = readFileSync(MANIFEST, "utf8");
  writeFileSync(MANIFEST, manifest.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`));
  execFileSync("npm", ["version", version, "--no-git-tag-version", "--allow-same-version"], { stdio: "inherit" });
  console.log(`Wrote ${version} to ${MANIFEST}, package.json and package-lock.json`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}


function manifestVersion(): string {
  const manifest: unknown = JSON.parse(readFileSync(MANIFEST, "utf8"));
  if (manifest && typeof manifest === "object" && "version" in manifest && typeof manifest.version === "string") {
    return manifest.version;
  }
  fail(`${MANIFEST} has no version`);
}