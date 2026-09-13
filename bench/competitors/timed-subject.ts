// ===========================================================================
// bench/competitors/timed-subject.ts
//
// The two things a child times, and the constants they are timed with.
//
// Separate from run-subject.ts so the sampling shape is stated once and both
// the subject and the floor are measured identically. A floor taken with a
// different warm-up or a different sample count would not be the floor of the
// measurement it is printed beside.
// ===========================================================================
import {
  calibrateIterations,
  estimateRate,
  takeRateSample,
  warmUp,
} from "../sample-rate";

export const TARGET_SAMPLE_MS = 60;
export const SAMPLE_COUNT = 9;
export const WARMUP_MS = 120;

/** Walks the pool and calls the library, in one closure. */
export function timedSubject(
  values: readonly unknown[],
  check: (value: unknown) => boolean
): () => boolean {
  const lastIndex = values.length - 1;
  let index = 0;
  return () => {
    const value = values[index];
    index = index === lastIndex ? 0 : index + 1;
    return check(value);
  };
}

/**
 * The same walk with no library under it.
 *
 * Reported, never subtracted. Subtracting would push its own error into every
 * ratio; printed beside the rates it lets a reader see when a ratio is being
 * decided by the harness rather than by the libraries — which is exactly what
 * went wrong the first time this comparison was published.
 */
export function measureFloor(values: readonly unknown[]): number {
  const floor = timedSubject(values, () => true);
  warmUp(floor, WARMUP_MS);
  const iterations = calibrateIterations(floor, TARGET_SAMPLE_MS);
  const rates: number[] = [];
  for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
    rates.push(takeRateSample(floor, iterations).opsPerSecond);
  }
  return estimateRate(rates);
}
