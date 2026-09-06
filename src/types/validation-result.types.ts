// ===========================================================================
// L0  src/types/validation-result.types.ts
// The discriminated result every entry point returns. Split out of l0-types so
// neither file grows past the 200-line rule.
// ===========================================================================
import type { ValidationIssue } from "./index";

export interface ValidationSuccess<T> {
  readonly valid: true;
  readonly data: T;
  readonly issues: readonly ValidationIssue[];
}

export interface ValidationRejection {
  readonly valid: false;
  readonly issues: readonly ValidationIssue[];
}

/** Narrows on `valid` with no cast: `data` exists only on the success branch. */
export type ValidationResult<T> = ValidationSuccess<T> | ValidationRejection;

/**
 * The second argument of validate() / parse(). `external` is the ONE channel a
 * pre-resolved async context arrives on; see l9-async-validator.ts. It lands in
 * RuleContext.external unchanged, so L5 needs no async-specific branch.
 */
export interface ValidateOptions {
  readonly abortEarly?: boolean;
  readonly abortEarlyOnEachField?: boolean;
  readonly external?: Readonly<Record<string, unknown>>;
}
