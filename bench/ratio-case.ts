// ===========================================================================
// bench/ratio-case.ts — WHAT a ratio is a ratio OF.
//
// The gate used to measure one thing: validate(), on a value that is accepted.
// Two of the three code paths a caller actually exercises were therefore never
// gated at all.
//
//   parse-accepted    parse runs the transform pipeline over a copy-on-write
//                     structure. It is the operation most likely to regress
//                     and it appeared in the baseline only as an ungated
//                     absolute figure.
//   validate-rejected under the default abortEarly the rejection path is a
//                     different program: it exits early, builds issue objects
//                     and materialises path strings. A regression that only
//                     shows on failure was invisible in every figure the
//                     harness produced.
//
// parse-rejected is deliberately absent: parse on a rejected value returns the
// same issue list validate does and adds nothing the other three do not cover,
// so it would cost a third of the gate's running time to measure a duplicate.
//
// The subjects are built HERE, once, so that the ratio measurement, the
// elimination canary and the agreement check are all talking about the same
// callable. A canary that certifies a subject the gate does not use certifies
// nothing.
// ===========================================================================
import { rotateOverValues, type ValuePool } from "./rotate-over-values";
import type { BenchShape, BenchValidator } from "./shapes/bench-shape.types";
import type { HandWrittenCheck } from "./hand-written/index";

export interface RatioCase {
  readonly operation: "validate" | "parse";
  readonly inputIsAccepted: boolean;
}

export const RATIO_CASES: readonly RatioCase[] = Object.freeze([
  { operation: "validate", inputIsAccepted: true },
  { operation: "parse", inputIsAccepted: true },
  { operation: "validate", inputIsAccepted: false },
]);

/** "validate/accepted" — the key floors are recorded under, and printed. */
export function describeRatioCase(ratioCase: RatioCase): string {
  return `${ratioCase.operation}/${ratioCase.inputIsAccepted ? "accepted" : "rejected"}`;
}

export function poolForCase(
  shape: BenchShape,
  ratioCase: RatioCase
): ValuePool {
  return ratioCase.inputIsAccepted
    ? shape.acceptedValues
    : shape.rejectedValues;
}

/**
 * The subject returns whether the call did WHAT WAS EXPECTED, not whether it
 * succeeded. On the rejection cases that inverts the boolean, which is what
 * lets one accepted-count assertion cover both directions: a validator that
 * started accepting a value this pool says is invalid fails the same check as
 * one that started rejecting a valid one.
 */
export function buildLuqSubject(
  validator: BenchValidator,
  shape: BenchShape,
  ratioCase: RatioCase
): () => boolean {
  const pool = poolForCase(shape, ratioCase);
  const expected = ratioCase.inputIsAccepted;
  if (ratioCase.operation === "parse") {
    return rotateOverValues(
      pool,
      (value) => validator.parse(value).valid === expected
    );
  }
  return rotateOverValues(
    pool,
    (value) => validator.validate(value).valid === expected
  );
}

export function buildReferenceSubject(
  reference: HandWrittenCheck,
  shape: BenchShape,
  ratioCase: RatioCase
): () => boolean {
  const pool = poolForCase(shape, ratioCase);
  const expected = ratioCase.inputIsAccepted;
  return rotateOverValues(pool, (value) => reference(value) === expected);
}
