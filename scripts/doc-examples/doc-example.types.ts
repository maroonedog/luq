/**
 * One code example in the documentation. `file` is a posix path relative to
 * the repository root and `startLine` is the opening fence's line, 1-based,
 * so a violation opens straight from an editor.
 */
export interface DocExample {
  readonly file: string;
  readonly startLine: number;
  readonly language: string;
  readonly expectation: DocExampleExpectation;
  readonly reason: string;
  readonly code: string;
  /**
   * How many prelude lines were prepended to `code`. A site excerpt stays a
   * short form on the page — using the validator the block above declared —
   * while the type check receives the complete form with a prelude. This is
   * subtracted to map a diagnostic's line back to the line in the document.
   * Always 0 for a Markdown example.
   */
  readonly preludeLineCount?: number;
}

/**
 * `compiles` by default. `must-fail` is for the migration guide's claim that
 * the old way no longer compiles: if it does compile, that is the violation.
 * `skip` is for fragments only — part of a chain with no imports, say — and
 * always requires a reason.
 */
export type DocExampleExpectation = "compiles" | "must-fail" | "skip";

export type DocExampleViolationKind =
  | "didNotCompile"
  | "compiledButMustFail"
  | "directiveWithoutReason"
  | "unknownDirective"
  | "unpublishedImport"
  | "brokenLink";

export interface DocExampleViolation {
  readonly file: string;
  readonly startLine: number;
  readonly kind: DocExampleViolationKind;
  readonly detail: string;
}
