// ===========================================================================
// scripts/check-suite-pin.ts — THE SUITE PIN GATE.
//
// docs/design/test-strategy.md: "check-suite-pin.ts fails when the recorded
// SHA moved without a matching skip-list change, so a suite bump is always a
// reviewed commit."
//
// The suite test (test/integration/json-schema-suite.test.ts) already asserts
// the corpus digest and the counts. What it CANNOT see is the commit itself:
// a submodule can be moved to a different revision whose corpus happens to be
// re-measured into the pin, and the published rate would then change without
// anyone reading the diff. So this gate compares three independent records of
// the same SHA —
//
//   1. config/json-schema-suite.json#commit          (the reviewed number)
//   2. the gitlink in the SUPERPROJECT index          (what a clone gets)
//   3. HEAD inside the checked-out submodule          (what was measured)
//
// and additionally re-derives the corpus digest and the skip-list size, so a
// bump cannot be recorded without re-reading the skip list.
// ===========================================================================
import { execFileSync } from "child_process";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import {
  isCorpusPresent,
  readSuiteCorpus,
  readSuitePin,
} from "../test/json-schema/read-suite-corpus";
import { SUITE_SKIPS } from "../test/json-schema/suite-skip-list";

export interface PinViolation {
  readonly subject: string;
  readonly recorded: string;
  readonly actual: string;
}

/** The commit the SUPERPROJECT records for the submodule path (mode 160000). */
export function readGitlinkCommit(
  repositoryRoot: string,
  submodulePath: string
): string {
  const line = execFileSync("git", ["ls-files", "-s", "--", submodulePath], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  const parts = line.split(/\s+/);
  if (parts[0] !== "160000" || parts[1] === undefined) {
    throw new Error(
      `${submodulePath} is not a git submodule in the index: "${line}"`
    );
  }
  return parts[1];
}

/** HEAD inside the checked-out submodule working tree. */
export function readCheckedOutCommit(
  repositoryRoot: string,
  submodulePath: string
): string {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: `${repositoryRoot}/${submodulePath}`,
    encoding: "utf8",
  }).trim();
}

export function findPinViolations(
  repositoryRoot: string
): readonly PinViolation[] {
  const pin = readSuitePin();
  const violations: PinViolation[] = [];
  const gitlink = readGitlinkCommit(repositoryRoot, pin.submodulePath);
  if (gitlink !== pin.commit) {
    violations.push({
      subject: "superproject gitlink",
      recorded: pin.commit,
      actual: gitlink,
    });
  }
  if (isCorpusPresent(pin)) {
    const head = readCheckedOutCommit(repositoryRoot, pin.submodulePath);
    if (head !== pin.commit) {
      violations.push({
        subject: "submodule HEAD",
        recorded: pin.commit,
        actual: head,
      });
    }
    const corpus = readSuiteCorpus(pin);
    if (corpus.contentDigest !== pin.contentDigest) {
      violations.push({
        subject: "corpus digest",
        recorded: pin.contentDigest,
        actual: corpus.contentDigest,
      });
    }
    if (corpus.caseCount !== pin.caseCount) {
      violations.push({
        subject: "corpus case count",
        recorded: String(pin.caseCount),
        actual: String(corpus.caseCount),
      });
    }
    if (corpus.groupCount !== pin.groupCount) {
      violations.push({
        subject: "corpus group count",
        recorded: String(pin.groupCount),
        actual: String(corpus.groupCount),
      });
    }
  }
  if (SUITE_SKIPS.length !== pin.skipEntryCount) {
    violations.push({
      subject: "skip list entries",
      recorded: String(pin.skipEntryCount),
      actual: String(SUITE_SKIPS.length),
    });
  }
  if (pin.passingCases + pin.skippedCases !== pin.caseCount) {
    violations.push({
      subject: "passing + skipped = cases",
      recorded: String(pin.caseCount),
      actual: String(pin.passingCases + pin.skippedCases),
    });
  }
  return violations;
}

if (require.main === module) {
  runCheckAndExit(() => {
    const violations = findPinViolations(REPOSITORY_ROOT);
    if (violations.length === 0) {
      const pin = readSuitePin();
      console.error(
        `Suite pin: matches (${pin.commit.slice(0, 12)}, ` +
          `${pin.caseCount} cases, ${pin.skipEntryCount} skipped)`
      );
      return 0;
    }
    console.error(`Suite pin: ${violations.length} mismatches:`);
    for (const violation of violations) {
      console.error(
        `  ${violation.subject}: recorded ${violation.recorded}, actual ${violation.actual}`
      );
    }
    console.error(
      "After moving the submodule, re-measure config/json-schema-suite.json, " +
        "re-read the skip list, and include both in the same commit."
    );
    return 1;
  });
}
