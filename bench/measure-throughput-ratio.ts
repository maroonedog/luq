// ===========================================================================
// bench/measure-throughput-ratio.ts — WHAT CI GATES ON.
//
// Luq and a hand-written validator for the SAME shape are measured in ONE
// process, interleaved sample by sample (see take-interleaved-samples.ts for
// why), and the gate asserts luq_ops / reference_ops >= a floor recorded in
// config/perf-baseline.json.
//
// Why not gate on ops/sec: a shared runner's throughput moves by a factor of
// two or more between runs. An absolute floor high enough to mean anything
// fails on a slow day; low enough never to fail, it catches nothing. Dividing
// by a reference measured on the same machine takes the machine out.
//
// The pairing is by BenchShapeName AND RatioCase on both sides, so it is not
// possible to divide the array shape's Luq figure by the flat shape's
// reference figure, nor the rejection path's by the accepted path's.
//
// Two checks run before any timing and both of them are new, because the only
// thing this file used to assert was that both sides said yes to the value it
// was about to hand them — which `() => true` also does:
//   - the reference must agree with Luq on a pool of values that are rejected
//     as well as on the pool that is accepted (assert-reference-agreement.ts);
//   - the reference must be measurably slower than an empty loop and must cost
//     twice as much when called twice (measure-reference-work.ts).
// ===========================================================================
import {
  DEFAULT_ATTEMPTS,
  DEFAULT_MAX_SPREAD_PERCENT,
  DEFAULT_SAMPLE_COUNT,
  DEFAULT_TARGET_SAMPLE_MS,
  DEFAULT_WARMUP_MS,
  type ThroughputOptions,
} from "./measure-throughput";
import { estimateRate, median, relativeSpreadPercent } from "./sample-rate";
import {
  takeInterleavedSamples,
  type InterleavedSamples,
} from "./take-interleaved-samples";
import { assertReferenceAgreesWithLuq } from "./assert-reference-agreement";
import {
  assertReferenceIsNotEliminated,
  measureReferenceWork,
} from "./measure-reference-work";
import {
  buildLuqSubject,
  buildReferenceSubject,
  describeRatioCase,
  type RatioCase,
} from "./ratio-case";
import { HAND_WRITTEN_CHECKS } from "./hand-written/index";
import type { BenchShape, BenchShapeName } from "./shapes/bench-shape.types";

export interface MeasuredRatio {
  readonly shape: BenchShapeName;
  readonly operation: "validate" | "parse";
  readonly inputIsAccepted: boolean;
  readonly luqOpsPerSecond: number;
  readonly referenceOpsPerSecond: number;
  /** Median of the per-pair ratios, NOT the ratio of the two medians. */
  readonly ratio: number;
  readonly luqSpreadPercent: number;
  readonly referenceSpreadPercent: number;
  /** Spread of the per-pair ratios: the number the floor answers to. */
  readonly ratioSpreadPercent: number;
  readonly isQuiet: boolean;
}

function assertEverythingBehavedAsExpected(
  shape: BenchShapeName,
  ratioCase: RatioCase,
  samples: InterleavedSamples
): void {
  const expectation = ratioCase.inputIsAccepted ? "accept" : "reject";
  if (samples.firstAccepted !== samples.firstIterations * samples.sampleCount) {
    throw new Error(
      `${shape} ${describeRatioCase(ratioCase)}: Luq stopped doing what the pool says it must (${expectation}); the ratio would compare two different code paths`
    );
  }
  if (
    samples.secondAccepted !==
    samples.secondIterations * samples.sampleCount
  ) {
    throw new Error(
      `${shape} ${describeRatioCase(ratioCase)}: the hand-written reference stopped doing what the pool says it must (${expectation}); it does not mirror the shape`
    );
  }
}

function measureRatioOnce(
  shape: BenchShape,
  ratioCase: RatioCase,
  options: ThroughputOptions
): MeasuredRatio {
  const reference = HAND_WRITTEN_CHECKS[shape.name];
  const validator = shape.buildValidator();

  const samples = takeInterleavedSamples(
    buildLuqSubject(validator, shape, ratioCase),
    buildReferenceSubject(reference, shape, ratioCase),
    {
      targetSampleMs: options.targetSampleMs ?? DEFAULT_TARGET_SAMPLE_MS,
      sampleCount: options.sampleCount ?? DEFAULT_SAMPLE_COUNT,
      warmupMs: options.warmupMs ?? DEFAULT_WARMUP_MS,
    }
  );
  assertEverythingBehavedAsExpected(shape.name, ratioCase, samples);

  const ratio = median(samples.pairRatios);
  const ratioSpread = relativeSpreadPercent(samples.pairRatios, ratio);
  const luqOpsPerSecond = estimateRate(samples.firstRates);
  const referenceOpsPerSecond = estimateRate(samples.secondRates);
  return {
    shape: shape.name,
    operation: ratioCase.operation,
    inputIsAccepted: ratioCase.inputIsAccepted,
    luqOpsPerSecond,
    referenceOpsPerSecond,
    ratio,
    luqSpreadPercent: relativeSpreadPercent(
      samples.firstRates,
      luqOpsPerSecond
    ),
    referenceSpreadPercent: relativeSpreadPercent(
      samples.secondRates,
      referenceOpsPerSecond
    ),
    ratioSpreadPercent: ratioSpread,
    isQuiet:
      ratioSpread <= (options.maxSpreadPercent ?? DEFAULT_MAX_SPREAD_PERCENT),
  };
}

/**
 * A noisy pairing is re-measured rather than reported, and the least disturbed
 * attempt wins — the same rule measureThroughput applies to absolute figures.
 * A gate that fails because the machine hiccuped teaches people to re-run it
 * until it goes green, which is the same as having no gate.
 *
 * The agreement check and the elimination canary run ONCE per pairing, before
 * the first attempt, because they answer questions about the code rather than
 * about the machine and re-running them would only cost time.
 */
export function measureThroughputRatio(
  shape: BenchShape,
  ratioCase: RatioCase,
  options: ThroughputOptions = {}
): MeasuredRatio {
  assertReferenceAgreesWithLuq(shape);
  assertReferenceIsNotEliminated(measureReferenceWork(shape, ratioCase));

  const attemptLimit = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS);
  let best = measureRatioOnce(shape, ratioCase, options);
  for (let attempt = 1; !best.isQuiet && attempt < attemptLimit; attempt += 1) {
    const retried = measureRatioOnce(shape, ratioCase, options);
    if (retried.ratioSpreadPercent < best.ratioSpreadPercent) best = retried;
  }
  return best;
}
