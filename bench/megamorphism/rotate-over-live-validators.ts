// ===========================================================================
// bench/megamorphism/rotate-over-live-validators.ts
//
// The subject that drives N validators, one call each, round and round.
//
// bench/rotate-over-values.ts rotates ONE consumer over a pool of values, for
// the reason recorded in its header: a constant argument is a constant
// expression and V8 deletes it. Here BOTH the validator and the value have to
// advance, so the rotation is written out again rather than wrapped.
//
// The two counters advance at different rates on purpose. The validator index
// moves every call, and the value index moves only when the validator index
// wraps. Advancing both every call would, whenever the validator count is a
// multiple of the pool size, pin each validator to one value for the whole run
// — forty validators each seeing a single frozen input, which is a different
// measurement from one validator seeing four. As written, a full cycle is
// `validators x poolSize` calls and every validator sees every one of its
// values exactly once per cycle, for every N.
//
// The overhead of the rotation itself — two array loads, two compares, two
// branches — is IDENTICAL for every N, which is what makes figures taken at
// different N comparable with each other. It is NOT identical to the overhead
// in bench/rotate-over-values.ts, so a figure from here must not be compared
// with a figure from config/perf-baseline.json.
// ===========================================================================
import type { LiveShape } from "./live-validator-family";

/**
 * Answers whether the validator gave the verdict the pool promised, not
 * whether the value passed. A subject that starts answering differently
 * partway through has lost the premise of the measurement, and the count of
 * true answers the sampler keeps is what reports it.
 *
 * The value index is bounded by the FIRST pool's length, which every member
 * shares. A member with a shorter pool would index past its end, and the
 * `undefined` guard turns that into a false answer rather than a crash — which
 * the agreed-call assertion in measure-live-window.ts then reports, instead of
 * the window being timed as though nothing were wrong.
 */
export function rotateOverLiveValidators(
  shapes: readonly LiveShape[],
  useAcceptedPool: boolean
): () => boolean {
  const validators = shapes.map((shape) => shape.validator);
  const pools = shapes.map((shape) =>
    useAcceptedPool ? shape.accepted : shape.rejected
  );
  const lastShape = validators.length - 1;
  const lastValue = (pools[0]?.length ?? 0) - 1;
  let shapeIndex = 0;
  let valueIndex = 0;

  return () => {
    const validator = validators[shapeIndex];
    const pool = pools[shapeIndex];
    const value = pool === undefined ? undefined : pool[valueIndex];
    if (shapeIndex === lastShape) {
      shapeIndex = 0;
      valueIndex = valueIndex === lastValue ? 0 : valueIndex + 1;
    } else {
      shapeIndex += 1;
    }
    if (validator === undefined || value === undefined) return false;
    return validator.validate(value).valid === useAcceptedPool;
  };
}

export class LiveVerdictError extends Error {}

/**
 * Every value in every pool, checked against the verdict its pool promises,
 * BEFORE anything is timed. Without this a family member whose rejected pool
 * had drifted into being accepted would be timed on the accepted path and
 * reported as the rejected one, and nothing in the figures could show it.
 */
export function assertPoolVerdicts(shapes: readonly LiveShape[]): number {
  let checked = 0;
  for (const shape of shapes) {
    for (const value of shape.accepted) {
      if (!shape.validator.validate(value).valid) {
        throw new LiveVerdictError(
          `${shape.label}: a value in the accepted pool was rejected`
        );
      }
      checked += 1;
    }
    for (const value of shape.rejected) {
      if (shape.validator.validate(value).valid) {
        throw new LiveVerdictError(
          `${shape.label}: a value in the rejected pool was accepted`
        );
      }
      checked += 1;
    }
  }
  return checked;
}
