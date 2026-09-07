// ===========================================================================
// bench/shapes/bench-shape.types.ts
//
// Every benchmarked shape is FIXED DATA: a name, a build() thunk, a pool of
// values the built validator accepts and a pool it rejects. Nothing here
// measures anything. Keeping the definitions apart from the harness is what
// lets the same five shapes be driven by the absolute recorder, by the
// in-process ratio gate and by the legacy comparison without any of the three
// re-declaring the schema and quietly measuring something else.
//
// The values are POOLS rather than single values because a single frozen value
// turned the hand-written reference into a constant expression that V8 deleted
// outright — see bench/rotate-over-values.ts for the measurement.
// ===========================================================================
import type { ValidateOptions } from "../../src/types/validation-result.types";
import type { ValuePool } from "../rotate-over-values";

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
  /**
   * `acceptedValues[0]`. The two callers that want ONE value rather than a
   * pool — the build-cost measurement and the 1.x comparison's entry guard —
   * name this, so they cannot pick a different member by accident.
   */
  readonly acceptedValue: unknown;
  /**
   * Values the built validator ACCEPTS, so no rule is skipped by abortEarly.
   * At least two, and distinct, so nothing about the subject is constant.
   */
  readonly acceptedValues: ValuePool;
  /**
   * Values the built validator REJECTS — and which the hand-written reference
   * must reject too. Two jobs. They are the negative half of the agreement
   * check: a reference written as `() => true` passed every assertion this
   * harness used to make, and fails this one. And they are the input of the
   * rejection-path ratio, which under abortEarly runs different code from the
   * accepted path (early exit, issue construction, path strings) and was
   * previously not measured at all.
   */
  readonly rejectedValues: ValuePool;
}
