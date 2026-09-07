// ===========================================================================
// L6  src/builder/validator.types.ts
// RESIDUAL 4 / item 3 — Validator.pick() restored, and PickPaths given the
// consumer it never had.
//
// Legacy shape (must-preserve, docs/legacy-spec/public-api-surface.md:134 and
// result-and-errors.md:17):
//     pick<K extends NestedKeyOf<T>>(key: K): FieldValidator<T, TypeOfPath<T,K>>
// The legacy spec also records that `pick("employees[*].name" as any)` needed a
// cast because NestedKeyOf broke on array-element paths. FieldPath/ValueAtPath
// do not, so the cast is gone; that is the whole point of the L1 rewrite.
// ===========================================================================
import type { FieldPath } from "../path/field-path.types";
import type { PickPaths, ValueAtPath } from "../path/value-at-path.types";
import type {
  ValidateOptions,
  ValidationResult,
} from "../types/validation-result.types";

/**
 * A single field lifted out of a built validator. `siblings` is the legacy
 * `allValues?: Partial<T>` argument: rules that reference other fields
 * (compareField, requiredIf, ...) read the root through it.
 */
export interface FieldValidator<TRoot extends object, TValue> {
  readonly path: string;
  validate(
    value: unknown,
    siblings?: Partial<TRoot>,
    options?: ValidateOptions
  ): ValidationResult<TValue>;
}

/**
 * THE CONSUMER OF PickPaths. A form validates several named paths at once and
 * wants back exactly those paths, keyed by the path string it asked for — not a
 * Partial<T> the caller has to re-narrow. `pickAll` builds one of these; the
 * paths are pre-resolved at that moment, matching user decision 1.
 */
export interface SubsetValidator<
  TRoot extends object,
  TPaths extends readonly string[],
> {
  readonly paths: TPaths;
  validate(
    value: unknown,
    options?: ValidateOptions
  ): ValidationResult<PickPaths<TRoot, TPaths>>;
}

export interface Validator<T extends object, TParsed = T> {
  validate(value: unknown, options?: ValidateOptions): ValidationResult<T>;
  parse(value: unknown, options?: ValidateOptions): ValidationResult<TParsed>;
  pick<K extends FieldPath<T> & string>(
    key: K
  ): FieldValidator<T, ValueAtPath<T, K>>;
  pickAll<const P extends readonly (FieldPath<T> & string)[]>(
    paths: P
  ): SubsetValidator<T, P>;
}
