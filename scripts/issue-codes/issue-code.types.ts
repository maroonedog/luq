// ===========================================================================
// scripts/issue-codes/issue-code.types.ts — the vocabulary of the issue-code
// machinery. Types and the one declared exception. No behaviour.
//
// `issue.code` is documented as the stable, machine-readable discriminator of
// a ValidationIssue. Nothing enforced that: the codes lived as string literals
// and plugin names scattered across src, no file listed them, and a rename was
// invisible in review. config/issue-code.lock.json is the list, and it is
// DERIVED — never typed by hand — so the lock and the source cannot drift.
// ===========================================================================

export const ISSUE_CODE_LOCK_OUTPUT = "config/issue-code.lock.json";

/**
 * How a site's code reaches a caller.
 *
 * `issue`  — the code lands on a ValidationIssue when the rule fails.
 * `gate`   — the code is carried by a gate rule. A closed gate ends the field
 *            with no issue at all (src/runtime/run-field.ts, openGates), so
 *            the code is ACCEPTED from a caller's `{ code }` option and can
 *            never be reported. Recorded separately for exactly that reason.
 */
export type CodeSiteKind = "issue" | "gate";

/** How the expression standing at a code-bearing position was understood. */
export type CodeResolution =
  | "literal"
  /** The code arrives from elsewhere — `ctx.code`, `spec.code`, a parameter. */
  | "forwarded"
  /** Nothing could be made of it. Recorded in the lock so it is reviewable. */
  | "unresolved";

export interface CodeSite {
  /** Repository-relative, posix separators. */
  readonly file: string;
  readonly line: number;
  readonly kind: CodeSiteKind;
  readonly resolution: CodeResolution;
  /** The codes this site can report. Empty unless the resolution is literal. */
  readonly codes: readonly string[];
  /** The source text of the expression, for a reviewer of an unresolved site. */
  readonly expression: string;
}

export interface IssueCodeEntry {
  readonly code: string;
  /**
   * Every place that can report this code, sorted.
   *
   * A plugin owner is its directory; a library owner is the file holding the
   * literal. Codes ARE legitimately shared — `required` is reported both by
   * the required plugin and by the missing-root rejection in
   * src/runtime/create-validator.ts — and recording the owners is what makes
   * a shared code visible as a deliberate sharing rather than a collision.
   */
  readonly owners: readonly string[];
}

export interface IssueCodeCatalog {
  /** Codes a ValidationIssue can carry. */
  readonly codes: readonly IssueCodeEntry[];
  /** Codes a caller may pass to a gate rule, which no issue can carry. */
  readonly gateOnlyCodes: readonly IssueCodeEntry[];
  /** `file:line — expression` for every site nothing could be made of. */
  readonly unresolvedSites: readonly string[];
}

export interface IssueCodeLock {
  readonly codeCount: number;
  readonly codes: readonly IssueCodeEntry[];
  readonly gateOnlyCodes: readonly IssueCodeEntry[];
  readonly unresolvedSites: readonly string[];
}

/**
 * A literal that is spelled at a code-bearing position but that no failure can
 * ever report, so it is not part of the vocabulary.
 *
 * There is one. OPEN_PRESENCE is the policy a field with no presence rule
 * carries; it permits undefined and null both, so `decidePresence` never
 * reaches its reporting branch. test/unit/compile/issue-code-vocabulary.test.ts
 * proves that at run time rather than taking this table's word for it.
 */
export interface UnreachableCodeSite {
  readonly file: string;
  readonly code: string;
  readonly reason: string;
}

export const UNREACHABLE_CODE_SITES: readonly UnreachableCodeSite[] = [
  {
    file: "src/compile/resolve-presence.ts",
    code: "presence",
    reason:
      "OPEN_PRESENCE permits every absence, so the policy cannot fail and " +
      "its code cannot reach an issue",
  },
];
