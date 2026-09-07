// ===========================================================================
// bench/take-interleaved-samples.ts
//
// Measures TWO subjects alternately — one sample of each, in turn — so that
// the ratio between them survives a machine this harness does not control.
//
// The alternative was tried and it failed: measuring all of subject A and then
// all of subject B leaves the two halves minutes apart, and a burst of load
// inside one half moves the ratio without moving the code. On the third trial
// run of the sequential version, a burst landed in the Luq half of the
// jsonSchema shape alone — Luq read 34,509 ops/sec against its usual 155,000
// while the reference half ran clean — and the gate reported a 4.6x regression
// that did not exist. Interleaved, the two samples of a pair are milliseconds
// apart, a burst hits both, and each pair's ratio is still about the code.
//
// Both consumers of this file divide one figure by another: the CI ratio gate
// (luq versus hand-written) and the build-cost measurement (build() versus
// validate(), the number that tests the pre-computation claim).
// ===========================================================================
import {
  calibrateIterations,
  takeRateSample,
  warmUp,
  type RateSample,
} from "./sample-rate";

export interface InterleavedOptions {
  readonly targetSampleMs: number;
  readonly sampleCount: number;
  readonly warmupMs: number;
}

export interface InterleavedSamples {
  readonly firstRates: readonly number[];
  readonly secondRates: readonly number[];
  /** firstRate / secondRate for each PAIR, measured milliseconds apart. */
  readonly pairRatios: readonly number[];
  readonly firstAccepted: number;
  readonly secondAccepted: number;
  readonly firstIterations: number;
  readonly secondIterations: number;
  readonly sampleCount: number;
}

/**
 * `first` and `second` are calibrated independently, so a 27k ops/sec subject
 * and a 200M ops/sec subject still produce samples of the same duration and
 * therefore see the same slice of machine noise.
 */
export function takeInterleavedSamples(
  first: () => boolean,
  second: () => boolean,
  options: InterleavedOptions
): InterleavedSamples {
  warmUp(first, options.warmupMs);
  warmUp(second, options.warmupMs);

  const firstIterations = calibrateIterations(first, options.targetSampleMs);
  const secondIterations = calibrateIterations(second, options.targetSampleMs);

  const firstRates: number[] = [];
  const secondRates: number[] = [];
  const pairRatios: number[] = [];
  let firstAccepted = 0;
  let secondAccepted = 0;
  for (let pair = 0; pair < options.sampleCount; pair += 1) {
    const takenFirst: RateSample = takeRateSample(first, firstIterations);
    const takenSecond: RateSample = takeRateSample(second, secondIterations);
    firstRates.push(takenFirst.opsPerSecond);
    secondRates.push(takenSecond.opsPerSecond);
    pairRatios.push(takenFirst.opsPerSecond / takenSecond.opsPerSecond);
    firstAccepted += takenFirst.acceptedCount;
    secondAccepted += takenSecond.acceptedCount;
  }

  return {
    firstRates,
    secondRates,
    pairRatios,
    firstAccepted,
    secondAccepted,
    firstIterations,
    secondIterations,
    sampleCount: options.sampleCount,
  };
}
