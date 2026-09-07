// ===========================================================================
// bench/measure-throughput.ts — the ABSOLUTE figure for one subject.
//
// Every ops/sec number in config/perf-baseline.json comes from here, so every
// number in that file was produced the same way and two of them can be divided
// honestly.
//
// Three deliberate choices, all of them things this harness got wrong first:
//  1. The subject returns a boolean and the loop COUNTS it (see sample-rate.ts).
//     A benchmark whose result is discarded can be deleted by the optimiser,
//     and then it measures an empty loop.
//  2. The reported figure is the median of the FASTEST HALF of the samples,
//     because interference is one-sided: it can only make a sample slower.
//     The mean follows one GC pause; the plain median follows a busy
//     neighbour for half the run; the single best sample will not reproduce.
//  3. A sample set that is too noisy is RE-MEASURED, and the least disturbed
//     attempt wins. `isQuiet` stays false when no attempt got under the
//     limit, so a figure taken on a busy machine is labelled, not laundered.
//     Measured on the recording machine while other agents were building: a
//     jsonSchema sample set spread 262% and reported 44k ops/sec where a quiet
//     run reports 152k. Writing that to the baseline unlabelled would have
//     published a number three times too low as if it were a fact.
// ===========================================================================
import {
  calibrateIterations,
  estimateRate,
  relativeSpreadPercent,
  takeRateSample,
  warmUp,
} from "./sample-rate";

export interface ThroughputMeasurement {
  readonly label: string;
  readonly opsPerSecond: number;
  readonly iterationsPerSample: number;
  readonly sampleCount: number;
  /** (max - min) / reported, in percent. High means the machine was noisy. */
  readonly relativeSpreadPercent: number;
  /** How many of the (iterations * samples) calls returned true. */
  readonly acceptedCount: number;
  /** How many attempts it took to get a spread under the limit. */
  readonly attempts: number;
  /** False when even the last attempt stayed above maxSpreadPercent. */
  readonly isQuiet: boolean;
}

export interface ThroughputOptions {
  readonly targetSampleMs?: number;
  readonly sampleCount?: number;
  readonly warmupMs?: number;
  readonly maxSpreadPercent?: number;
  readonly attempts?: number;
}

export const DEFAULT_TARGET_SAMPLE_MS = 120;
export const DEFAULT_SAMPLE_COUNT = 9;
export const DEFAULT_WARMUP_MS = 250;
export const DEFAULT_MAX_SPREAD_PERCENT = 20;
export const DEFAULT_ATTEMPTS = 4;

function runOneAttempt(
  label: string,
  subject: () => boolean,
  options: ThroughputOptions
): ThroughputMeasurement {
  const targetSampleMs = options.targetSampleMs ?? DEFAULT_TARGET_SAMPLE_MS;
  const sampleCount = options.sampleCount ?? DEFAULT_SAMPLE_COUNT;
  warmUp(subject, options.warmupMs ?? DEFAULT_WARMUP_MS);

  const iterationsPerSample = calibrateIterations(subject, targetSampleMs);
  const rates: number[] = [];
  let acceptedCount = 0;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const taken = takeRateSample(subject, iterationsPerSample);
    rates.push(taken.opsPerSecond);
    acceptedCount += taken.acceptedCount;
  }

  const opsPerSecond = estimateRate(rates);
  const spread = relativeSpreadPercent(rates, opsPerSecond);
  return {
    label,
    opsPerSecond,
    iterationsPerSample,
    sampleCount,
    relativeSpreadPercent: spread,
    acceptedCount,
    attempts: 1,
    isQuiet: spread <= (options.maxSpreadPercent ?? DEFAULT_MAX_SPREAD_PERCENT),
  };
}

/**
 * Measure how many times `subject` can run per second. `subject` must do the
 * whole unit of work being claimed — a full validate() call, not a cached one —
 * and must return whether the call succeeded.
 */
export function measureThroughput(
  label: string,
  subject: () => boolean,
  options: ThroughputOptions = {}
): ThroughputMeasurement {
  const attemptLimit = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS);
  let best = runOneAttempt(label, subject, options);
  let attempt = 1;
  while (!best.isQuiet && attempt < attemptLimit) {
    attempt += 1;
    const retried = runOneAttempt(label, subject, options);
    if (retried.relativeSpreadPercent < best.relativeSpreadPercent) {
      best = retried;
    }
  }
  return { ...best, attempts: attempt };
}
