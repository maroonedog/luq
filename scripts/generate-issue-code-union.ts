// ===========================================================================
// scripts/generate-issue-code-union.ts — writes src/types/issue-code.generated.ts.
//
// config/issue-code.lock.json made a rename VISIBLE in review. This makes the
// same vocabulary USABLE from a caller's own code: a union a `switch` can be
// checked for exhaustiveness against, and a predicate that narrows a string to
// it.
//
// `ValidationIssue.code` stays `string`, deliberately. Narrowing it would
// break every caller already assigning one, and it would be a lie besides:
// `{ code }` lets a rule carry a code this library never chose, and a custom
// plugin can report anything it likes. The union is what LUQ reports, not what
// the field can hold, and the two are different facts.
//
// Derived from the same catalog as the lock, so the union cannot describe a
// vocabulary the lock does not. Arranged like generate-slot-catalog.ts —
// derive, render, write only on a change — because a second arrangement for
// the same job is a second thing to keep true.
// ===========================================================================
import { buildIssueCodeCatalog } from "./issue-codes/build-issue-code-catalog";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import { writeGeneratedFile } from "./catalog/write-generated-file";

export const ISSUE_CODE_UNION_OUTPUT = "src/types/issue-code.generated.ts";

const HEADER = [
  "/**",
  " * Every code Luq itself reports on a ValidationIssue.",
  " *",
  " * `ValidationIssue.code` is `string`, not this union, and that is not an",
  " * oversight. A rule can be given any code through `{ code }`, and a custom",
  " * plugin reports whatever it chooses, so the field genuinely holds a string.",
  " * This is the narrower fact: the vocabulary the LIBRARY draws from.",
  " *",
  " * What it is for:",
  " *",
  " *   switch (code as IssueCode) — an exhaustive switch the compiler checks",
  " *   isIssueCode(issue.code)    — did this come from Luq, or from a rule's",
  " *                                own `{ code }`?",
  " *",
  " * Gate codes are absent on purpose. `skip` and `validateIf` are accepted",
  " * from a caller, but a closed gate ends the field with no issue at all, so",
  " * no ValidationIssue can carry one. They are listed separately in",
  " * config/issue-code.lock.json.",
  " */",
].join("\n");

function renderUnion(codes: readonly string[]): string {
  const members = codes.map((code) => `  | ${JSON.stringify(code)}`).join("\n");
  const listed = codes.map((code) => `  ${JSON.stringify(code)},`).join("\n");
  return [
    HEADER,
    `export type IssueCode =`,
    `${members};`,
    "",
    "/**",
    " * The same vocabulary at run time, sorted, for a caller that needs it.",
    " *",
    " * Marked pure so a bundle that only uses the TYPE carries none of it. The",
    " * type is erased at compile time and costs nothing; this array is 95",
    " * strings, and a consumer who never names it should not pay for them.",
    " */",
    "export const ISSUE_CODES: readonly IssueCode[] = /* @__PURE__ */ Object.freeze([",
    listed,
    "]);",
    "",
    "/**",
    " * Built on first use, never at module load.",
    " *",
    " * `new Set(...)` at the top level is a side effect, and a side effect is",
    " * something a bundler must keep whether or not anything reads it — which",
    " * put this module into every entry the size budget measures, including the",
    " * ones that import no plugin at all.",
    " */",
    "let issueCodeSet: ReadonlySet<string> | null = null;",
    "",
    "/**",
    " * Whether a code is one Luq reports.",
    " *",
    " * False for a code a rule was given through `{ code }` and for one a custom",
    " * plugin invented — which is the question worth asking, because those are",
    " * the codes a caller's own switch has to handle itself.",
    " */",
    "export function isIssueCode(code: string): code is IssueCode {",
    "  issueCodeSet ??= new Set(ISSUE_CODES);",
    "  return issueCodeSet.has(code);",
    "}",
    "",
  ].join("\n");
}

export function renderIssueCodeUnion(repositoryRoot: string): string {
  const catalog = buildIssueCodeCatalog(repositoryRoot);
  return renderUnion(catalog.codes.map((entry) => entry.code));
}

export function generateIssueCodeUnion(repositoryRoot: string): boolean {
  return writeGeneratedFile(
    repositoryRoot,
    ISSUE_CODE_UNION_OUTPUT,
    renderIssueCodeUnion(repositoryRoot)
  );
}

if (require.main === module) {
  runCheckAndExit(() => {
    const changed = generateIssueCodeUnion(REPOSITORY_ROOT);
    console.error(
      `${ISSUE_CODE_UNION_OUTPUT}: ${changed ? "updated" : "unchanged"}`
    );
    return 0;
  });
}
