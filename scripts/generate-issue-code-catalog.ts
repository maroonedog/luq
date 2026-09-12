// ===========================================================================
// scripts/generate-issue-code-catalog.ts — writes config/issue-code.lock.json.
//
// README documents `issue.code` as "which rule, stable across messages". The
// lock is what makes "stable" mean something: every code the library can put
// on a ValidationIssue is listed with the places that report it, so renaming
// one is a diff in a committed file and a deliberate act, and check-issue-code-
// lock.ts fails the build until that diff is made.
//
// Arranged exactly like scripts/generate-plugin-catalog.ts — derive, render,
// write only on a change — because a second arrangement for the same job is a
// second thing to keep true.
// ===========================================================================
import { buildIssueCodeCatalog } from "./issue-codes/build-issue-code-catalog";
import { ISSUE_CODE_LOCK_OUTPUT } from "./issue-codes/issue-code.types";
import type { IssueCodeLock } from "./issue-codes/issue-code.types";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import { writeGeneratedFile } from "./catalog/write-generated-file";

export function buildIssueCodeLock(repositoryRoot: string): IssueCodeLock {
  const catalog = buildIssueCodeCatalog(repositoryRoot);
  return {
    codeCount: catalog.codes.length,
    codes: catalog.codes,
    gateOnlyCodes: catalog.gateOnlyCodes,
    unresolvedSites: catalog.unresolvedSites,
  };
}

export function renderIssueCodeLock(repositoryRoot: string): string {
  return `${JSON.stringify(buildIssueCodeLock(repositoryRoot), null, 2)}\n`;
}

export function generateIssueCodeLock(repositoryRoot: string): boolean {
  return writeGeneratedFile(
    repositoryRoot,
    ISSUE_CODE_LOCK_OUTPUT,
    renderIssueCodeLock(repositoryRoot)
  );
}

if (require.main === module) {
  runCheckAndExit(() => {
    const changed = generateIssueCodeLock(REPOSITORY_ROOT);
    console.error(
      `${ISSUE_CODE_LOCK_OUTPUT}: ${changed ? "updated" : "unchanged"}`
    );
    return 0;
  });
}
