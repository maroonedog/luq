import type { FieldPath } from "../path/field-path.types";
import type { ValidationIssue } from "../types";
import type { ValidateOptions } from "../types/validation-result.types";

type ExpandIndices<P extends string> = P extends `${infer Head}[*]${infer Tail}`
  ? `${Head}${"[*]" | `[${number}]` | `.${number}`}${ExpandIndices<Tail>}`
  : P;

/** Declaration patterns and concrete bracket/dot array indices. */
export type FormFieldPath<T> = ExpandIndices<FieldPath<T> & string>;

/** Success covers the selected declarations only; no whole-object type claim. */
export interface PartialValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

export interface PartialValidator<TPath extends string> {
  readonly paths: readonly TPath[];
  validate(value: unknown, options?: ValidateOptions): PartialValidationResult;
}
