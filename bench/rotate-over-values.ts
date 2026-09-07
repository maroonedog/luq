// ===========================================================================
// bench/rotate-over-values.ts — the fix for a reference that was not there.
//
// A subject that calls a pure function with the SAME frozen argument every
// iteration is a constant expression, and V8 is entitled to fold it away. It
// did. Measured on this machine before this file existed: the singleField
// hand-written reference reported 230,983,694 ops/sec against an empty loop's
// 226,252,859 — FASTER than doing nothing — and calling it twice per iteration
// changed the figure by 4% where it should have halved it. The ratio gate for
// that shape was dividing Luq's throughput by the harness's own loop speed.
//
// Rotating over a POOL of distinct values removes the premise: the argument is
// loaded from an array and differs from call to call, so there is no constant
// to fold and the call has to happen. Both sides of every ratio are wrapped the
// same way, so the rotation's own cost (about 1 ns/call, recorded per shape as
// `harnessFloorOpsPerSecond`) is charged to Luq and to the reference alike.
//
// The pool entries are built as object literals with identical key order, so
// they share one hidden class and neither side pays a polymorphism penalty the
// other does not.
// ===========================================================================

/** At least two values, so there is nothing constant to fold. */
export type ValuePool = readonly [unknown, unknown, ...unknown[]];

/**
 * Wraps `consume` in a subject that feeds it the pool in order, wrapping round.
 * `undefined` cannot appear in a pool built by this repository's shapes; the
 * guard exists so the index stays honest without a cast, and a subject that
 * ever hits it returns false, which the accepted-count assertion reports.
 */
export function rotateOverValues(
  values: ValuePool,
  consume: (value: unknown) => boolean
): () => boolean {
  const pool = values;
  const lastIndex = pool.length - 1;
  let index = 0;
  return () => {
    const value = pool[index];
    index = index === lastIndex ? 0 : index + 1;
    return value !== undefined && consume(value);
  };
}

/** The empty subject, rotated identically. What the pool itself costs. */
export function rotateOverNothing(values: ValuePool): () => boolean {
  return rotateOverValues(values, () => true);
}
