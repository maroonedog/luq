// ===========================================================================
// src/result/index.ts — THE ./result SUBPATH.
//
// The vocabulary a CALLER reads a ValidationResult with. It carries no
// dependency on the builder, the compiler or the runtime, so a consumer that
// only passes results around (a form layer, an HTTP boundary) can import this
// subpath and pull in nothing else.
//
// EMPTY_ISSUES is a frozen singleton: a successful validate() allocates no
// array at all, and freezing makes the sharing safe to observe.
// ===========================================================================
import type { ValidationIssue } from "../types";
import type {
  ValidationRejection,
  ValidationResult,
  ValidationSuccess,
} from "../types/validation-result.types";

export type {
  ValidationRejection,
  ValidationResult,
  ValidationSuccess,
} from "../types/validation-result.types";

/** The one array every issue-free result shares. Frozen, so sharing is safe. */
export const EMPTY_ISSUES: readonly ValidationIssue[] = Object.freeze([]);

export function ok<T>(
  value: T,
  issues: readonly ValidationIssue[] = EMPTY_ISSUES
): ValidationSuccess<T> {
  return { valid: true, data: value, issues };
}

export function reject(
  issues: readonly ValidationIssue[]
): ValidationRejection {
  return { valid: false, issues };
}

export function isOk<T>(
  result: ValidationResult<T>
): result is ValidationSuccess<T> {
  return result.valid;
}

/** One line per issue, so a thrown failure is readable without unpacking it. */
function describeIssues(issues: readonly ValidationIssue[]): string {
  if (issues.length === 0) return "Validation failed";
  return issues
    .map((issue) => `${issue.path}: ${issue.message} (${issue.code})`)
    .join("\n");
}

/**
 * An Error that CARRIES the issues rather than flattening them into a string,
 * so a catch block can still inspect paths and codes.
 */
export class ValidationFailure extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(describeIssues(issues));
    this.name = "ValidationFailure";
    this.issues = issues;
  }
}

/** The success value, or a thrown ValidationFailure carrying the issues. */
export function unwrap<T>(result: ValidationResult<T>): T {
  if (result.valid) return result.data;
  throw new ValidationFailure(result.issues);
}
