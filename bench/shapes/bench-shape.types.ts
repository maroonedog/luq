// ===========================================================================
// bench/shapes/bench-shape.types.ts
//
// Every benchmarked shape is FIXED DATA: a name, a build() thunk, and a value
// that the built validator accepts. Nothing here measures anything. Keeping
// the definitions apart from the harness is what lets the same five shapes be
// driven by the absolute recorder, by the in-process ratio gate and by the
// legacy comparison without any of the three re-declaring the schema and
// quietly measuring something else.
// ===========================================================================
import type { ValidateOptions } from "../../src/types/validation-result.types";

/** The five shapes named in the build order for step 30. */
export type BenchShapeName =
  | "singleField"
  | "multiField"
  | "nested"
  | "array"
  | "jsonSchema";

/**
 * The subset of a built Luq validator the harness uses. Deliberately narrower
 * than `Validator<T>`: pick/pickAll are not on the hot path of any published
 * claim, so no bench file may reach for them by accident.
 */
export interface BenchValidator {
  validate(
    value: unknown,
    options?: ValidateOptions
  ): { readonly valid: boolean };
  parse(value: unknown, options?: ValidateOptions): { readonly valid: boolean };
}

export interface BenchShape {
  readonly name: BenchShapeName;
  /** Human-readable statement of what the shape declares. Goes in the report. */
  readonly declares: string;
  /** Runs the whole builder chain. Called once per build-cost iteration. */
  buildValidator(): BenchValidator;
  /** A value the built validator ACCEPTS, so no rule is skipped by abortEarly. */
  readonly acceptedValue: unknown;
}
