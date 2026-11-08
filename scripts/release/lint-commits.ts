/**
 * Fails when a commit in the range does not follow Conventional Commits.
 *
 *   node scripts/release/lint-commits.ts <git log range, e.g. origin/main..HEAD>
 */
import { lintCommit } from "./conventional.ts";
import { commitsIn } from "./git.ts";

const range = process.argv[2];
if (!range) {
  console.error("Usage: node scripts/release/lint-commits.ts <range>");
  process.exit(2);
}

const problems = commitsIn(range).flatMap((c) => {
  const problem = lintCommit(c);
  return problem ? [`${c.sha.slice(0, 7)} ${problem}`] : [];
});

if (problems.length > 0) {
  console.error(`Commit messages must follow Conventional Commits (see CONTRIBUTING.md):\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`All commits in ${range} follow Conventional Commits.`);
