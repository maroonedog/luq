// ===========================================================================
// bench/sample-rate.ts — warm-up, calibration, and ONE timed sample.
//
// Split out of measure-throughput.ts because two callers need the pieces and
// want them arranged differently: the absolute recorder takes all of one
// subject's samples in a row, while the ratio gate INTERLEAVES two subjects
// sample by sample. Both must nevertheless calibrate and time identically, or
// their figures cannot be compared with each other.
//
// The subject returns a boolean and every loop COUNTS it, so an optimiser
// cannot delete the work as unobserved, and the count doubles as proof the
// subject really did accept what it was given.
// ===========================================================================

export interface RateSample {
  readonly opsPerSecond: number;
  readonly acceptedCount: number;
}

const NANOSECONDS_PER_SECOND = 1e9;
const CALIBRATION_FLOOR_MS = 20;
const MAX_CALIBRATION_ITERATIONS = 1e8;

/** Runs the subject for a wall-clock duration, discarding the timing. */
export function warmUp(subject: () => boolean, milliseconds: number): number {
  const deadline = process.hrtime.bigint() + BigInt(milliseconds) * 1000000n;
  let accepted = 0;
  while (process.hrtime.bigint() < deadline) {
    for (let repetition = 0; repetition < 64; repetition += 1) {
      if (subject()) accepted += 1;
    }
  }
  return accepted;
}

/**
 * How many iterations make one sample last about `targetMs`. Calibrating per
 * subject is what lets a 27k ops/sec shape and a 200M ops/sec reference be
 * measured over the same wall clock, so neither is dominated by timer
 * resolution and neither is measured over a different slice of machine noise.
 */
export function calibrateIterations(
  subject: () => boolean,
  targetMs: number
): number {
  let iterations = 64;
  let accepted = 0;
  for (;;) {
    const startedAt = process.hrtime.bigint();
    for (let index = 0; index < iterations; index += 1) {
      if (subject()) accepted += 1;
    }
    const elapsedMs =
      Number(process.hrtime.bigint() - startedAt) / 1000000 || 0.001;
    if (
      elapsedMs >= CALIBRATION_FLOOR_MS ||
      iterations >= MAX_CALIBRATION_ITERATIONS
    ) {
      return Math.max(1, Math.round((iterations * targetMs) / elapsedMs));
    }
    iterations *= 4;
    if (accepted < 0) throw new Error("unreachable");
  }
}

/** One timed run of exactly `iterations` calls. */
export function takeRateSample(
  subject: () => boolean,
  iterations: number
): RateSample {
  let acceptedCount = 0;
  const startedAt = process.hrtime.bigint();
  for (let index = 0; index < iterations; index += 1) {
    if (subject()) acceptedCount += 1;
  }
  const elapsedNs = Number(process.hrtime.bigint() - startedAt);
  return {
    opsPerSecond: (iterations * NANOSECONDS_PER_SECOND) / elapsedNs,
    acceptedCount,
  };
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  if (upper === undefined) return 0;
  if (sorted.length % 2 === 1 || lower === undefined) return upper;
  return (lower + upper) / 2;
}

/**
 * Median of the FASTEST HALF. Interference on a shared machine is one-sided —
 * it can only make a sample slower — so the slow tail is noise about the
 * machine and the fast half is signal about the code.
 */
export function estimateRate(rates: readonly number[]): number {
  const sorted = [...rates].sort((left, right) => left - right);
  return median(sorted.slice(Math.floor(sorted.length / 2)));
}

/**
 * FULL range of the samples over the reported figure. Say it that way when
 * quoting it: the two statistics are deliberately different and it is easy to
 * read this as a confidence interval, which it is not. `estimateRate` reports
 * the median of the fastest half — with nine samples, the seventh slowest,
 * about the 72nd percentile — while this divides (max - min) across ALL nine by
 * that value. It is therefore an upper bound on the disturbance and always
 * larger than the scatter around the number it accompanies.
 */
export function relativeSpreadPercent(
  rates: readonly number[],
  reported: number
): number {
  if (rates.length === 0 || reported === 0) return 0;
  return ((Math.max(...rates) - Math.min(...rates)) / reported) * 100;
}
