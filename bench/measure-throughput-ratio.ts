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
// The pairing is by BenchShapeName on both sides, so it is not possible to
// divide the array shape's Luq figure by the flat shape's reference figure.
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
import { HAND_WRITTEN_CHECKS } from "./hand-written/index";
import type { BenchShape, BenchShapeName } from "./shapes/bench-shape.types";

export interface MeasuredRatio {
  readonly shape: BenchShapeName;
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

function assertEverythingWasAccepted(
  shape: BenchShapeName,
  samples: InterleavedSamples
): void {
  if (samples.firstAccepted !== samples.firstIterations * samples.sampleCount) {
    throw new Error(
      `${shape}: Luq rejected the accepted value; the ratio would compare a failure path`
    );
  }
  if (
    samples.secondAccepted !==
    samples.secondIterations * samples.sampleCount
  ) {
    throw new Error(
      `${shape}: the hand-written reference rejected the accepted value; it does not mirror the shape`
    );
  }
}

function measureRatioOnce(
  shape: BenchShape,
  options: ThroughputOptions
): MeasuredRatio {
  const reference = HAND_WRITTEN_CHECKS[shape.name];
  const validator = shape.buildValidator();
  const acceptedValue = shape.acceptedValue;

  const samples = takeInterleavedSamples(
    () => validator.validate(acceptedValue).valid,
    () => reference(acceptedValue),
    {
      targetSampleMs: options.targetSampleMs ?? DEFAULT_TARGET_SAMPLE_MS,
      sampleCount: options.sampleCount ?? DEFAULT_SAMPLE_COUNT,
      warmupMs: options.warmupMs ?? DEFAULT_WARMUP_MS,
    }
  );
  assertEverythingWasAccepted(shape.name, samples);

  const ratio = median(samples.pairRatios);
  const ratioSpread = relativeSpreadPercent(samples.pairRatios, ratio);
  const luqOpsPerSecond = estimateRate(samples.firstRates);
  const referenceOpsPerSecond = estimateRate(samples.secondRates);
  return {
    shape: shape.name,
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
 */
export function measureThroughputRatio(
  shape: BenchShape,
  options: ThroughputOptions = {}
): MeasuredRatio {
  const attemptLimit = Math.max(1, options.attempts ?? DEFAULT_ATTEMPTS);
  let best = measureRatioOnce(shape, options);
  for (let attempt = 1; !best.isQuiet && attempt < attemptLimit; attempt += 1) {
    const retried = measureRatioOnce(shape, options);
    if (retried.ratioSpreadPercent < best.ratioSpreadPercent) best = retried;
  }
  return best;
}
