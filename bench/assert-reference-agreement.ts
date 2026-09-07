// ===========================================================================
// bench/assert-reference-agreement.ts
//
// The check the harness did not have: does the hand-written reference actually
// CHECK anything, and does it check the same thing Luq does?
//
// Everything the ratio measurement asserted was one-sided — both subjects
// accepted the accepted value — and a reference written as `() => true`
// satisfies that unconditionally. It is not a hypothetical: for the
// singleField shape the reference was being deleted by the optimiser, which is
// the same thing as `() => true`, and no assertion in this directory noticed
// for the life of the file.
//
// This runs before any timing, costs a few dozen calls, and is deterministic.
// It fails loudly rather than producing a number, because a ratio against a
// reference that disagrees with Luq is not a slow number, it is a wrong one.
// ===========================================================================
import { HAND_WRITTEN_CHECKS } from "./hand-written/index";
import type { BenchShape } from "./shapes/bench-shape.types";

function describeValue(value: unknown): string {
  try {
    return JSON.stringify(value)?.slice(0, 120) ?? String(value);
  } catch {
    return String(value);
  }
}

function assertPool(
  shape: BenchShape,
  pool: readonly unknown[],
  expected: boolean
): void {
  const reference = HAND_WRITTEN_CHECKS[shape.name];
  const validator = shape.buildValidator();
  const label = expected ? "acceptedValues" : "rejectedValues";

  for (let index = 0; index < pool.length; index += 1) {
    const value = pool[index];
    const byLuq = validator.validate(value).valid;
    const byParse = validator.parse(value).valid;
    const byReference = reference(value);

    if (byLuq !== expected) {
      throw new Error(
        `${shape.name}: ${label}[${index}] is ${byLuq ? "accepted" : "rejected"} by Luq's validate() and the pool says it must be ${expected ? "accepted" : "rejected"} — ${describeValue(value)}`
      );
    }
    if (byParse !== expected) {
      throw new Error(
        `${shape.name}: ${label}[${index}] disagrees between validate() and parse(); the parse ratio would measure a different outcome — ${describeValue(value)}`
      );
    }
    if (byReference !== expected) {
      throw new Error(
        `${shape.name}: the hand-written reference ${byReference ? "accepts" : "rejects"} ${label}[${index}] and Luq does the opposite, so the two are not validating the same language — ${describeValue(value)}`
      );
    }
  }
}

/**
 * Both pools, both directions, for one shape. The rejected pool is the half
 * that has teeth: it is the only thing standing between the gate and a
 * reference that answers true to everything.
 */
export function assertReferenceAgreesWithLuq(shape: BenchShape): void {
  if (shape.acceptedValues.length < 2 || shape.rejectedValues.length < 2) {
    throw new Error(
      `${shape.name}: each pool needs at least two values, or the subject is a constant expression and the optimiser may delete it`
    );
  }
  assertPool(shape, shape.acceptedValues, true);
  assertPool(shape, shape.rejectedValues, false);
}
