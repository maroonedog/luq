// ===========================================================================
// bench/competitors/measure-competitor-ratio.ts
//
// Measures Luq and a competitor alternately against the same pool of values.
//
// Alternating matters because measuring one of them to completion first drops
// whatever else the machine was doing onto one side, and the ratio moves.
//
// **Only values whose verdicts agreed are timed.** Disagreements are counted
// elsewhere; timing them here would report "the other library did different
// work" as a difference in speed. They are not discarded, only reported in
// their own column.
//
// Only the validate-equivalent round trip is timed, never parse. Most
// competitors do not separate validating from converting, and forcing a
// correspondence makes the comparison the arbitrary part.
// ===========================================================================
import { median, relativeSpreadPercent } from "../sample-rate";
import { takeInterleavedSamples } from "../take-interleaved-samples";
import { rotateOverValues, type ValuePool } from "../rotate-over-values";
import type { BenchShape, BenchShapeName } from "../shapes/bench-shape.types";
import type { Competitor } from "./competitor.types";
import { measureShapeAgreement } from "./measure-agreement";

/** One pool, timed. */
export interface PoolRatio {
  readonly luqOpsPerSecond: number;
  readonly competitorOpsPerSecond: number;
  /** Above 1 means Luq is faster. The median of the per-pair ratios. */
  readonly ratio: number;
  readonly values: number;
  readonly luqSpreadPercent: number;
  readonly competitorSpreadPercent: number;
}

export interface CompetitorRatio {
  readonly shape: BenchShapeName;
  readonly competitor: string;
  readonly competitorVersion: string;
  readonly luqOpsPerSecond: number;
  readonly competitorOpsPerSecond: number;
  /** Above 1 means Luq is faster. The median of the per-pair ratios. */
  readonly ratio: number;
  /** How many values were timed, and how many were excluded as disagreements. */
  readonly comparedValues: number;
  readonly disagreedValues: number;
  readonly luqSpreadPercent: number;
  readonly competitorSpreadPercent: number;
  /**
   * The same measurement over the accepted values alone and the rejected ones
   * alone.
   *
   * The mixed figure above is what this file used to report on its own, and it
   * is kept so a reader can see the difference rather than having to trust that
   * there is one. There usually is: a library that constructs a rich error on
   * every refusal does most of its work in `rejected`, so a pool that is half
   * refusals measures error construction as much as validation. Published as
   * one number, that reads as a validation result.
   *
   * `undefined` when a pool held fewer than two values — the engine
   * constant-folds a single value away on one side and not the other.
   */
  readonly accepted: PoolRatio | undefined;
  readonly rejected: PoolRatio | undefined;
}

const TARGET_SAMPLE_MS = 60;
const SAMPLE_COUNT = 9;
const WARMUP_MS = 120;

/**
 * Builds the function that cycles over the agreed values. What it returns is
 * "did it answer as expected", not "did it pass": if either side starts
 * answering differently partway through, the premise of the comparison has
 * broken, and the caller can notice by comparing the counts.
 */
function buildRotation(
  values: ValuePool,
  judge: (value: unknown) => boolean,
  expected: ReadonlyMap<unknown, boolean>
): () => boolean {
  return rotateOverValues(
    values,
    (value) => judge(value) === expected.get(value)
  );
}

/**
 * A value pool requires at least two values, in the type. A competitor
 * agreeing on only one value is not measured: with a single value the engine
 * constant-folds it away on one side and not the other.
 */
function toPool(values: readonly unknown[]): ValuePool | undefined {
  const [first, second, ...rest] = values;
  if (values.length < 2) return undefined;
  return [first, second, ...rest];
}

/** Times one pool of agreed values, Luq and the competitor alternately. */
function timePool(
  values: readonly unknown[],
  validator: { validate(value: unknown): { valid: boolean } },
  check: (value: unknown) => boolean,
  expected: ReadonlyMap<unknown, boolean>
): PoolRatio | undefined {
  const pool = toPool(values);
  if (pool === undefined) return undefined;

  const samples = takeInterleavedSamples(
    buildRotation(pool, (v) => validator.validate(v).valid, expected),
    buildRotation(pool, check, expected),
    {
      targetSampleMs: TARGET_SAMPLE_MS,
      sampleCount: SAMPLE_COUNT,
      warmupMs: WARMUP_MS,
    }
  );

  const luqMedian = median(samples.firstRates);
  const otherMedian = median(samples.secondRates);

  return {
    luqOpsPerSecond: luqMedian,
    competitorOpsPerSecond: otherMedian,
    ratio: median(samples.pairRatios),
    values: values.length,
    luqSpreadPercent: relativeSpreadPercent(samples.firstRates, luqMedian),
    competitorSpreadPercent: relativeSpreadPercent(
      samples.secondRates,
      otherMedian
    ),
  };
}

export function measureCompetitorRatio(
  shape: BenchShape,
  competitor: Competitor
): CompetitorRatio | undefined {
  const subject = competitor.subjects[shape.name];
  const agreement = measureShapeAgreement(shape, competitor);
  if (subject === undefined || agreement === undefined) return undefined;
  if (agreement.agreedValues.length === 0) return undefined;

  const validator = shape.buildValidator();
  const expected = new Map<unknown, boolean>();
  for (const value of agreement.agreedValues) {
    expected.set(value, validator.validate(value).valid);
  }

  const check = (value: unknown): boolean => subject.check(value);
  const mixed = timePool(agreement.agreedValues, validator, check, expected);
  if (mixed === undefined) return undefined;

  return {
    shape: shape.name,
    competitor: competitor.name,
    competitorVersion: competitor.version,
    luqOpsPerSecond: mixed.luqOpsPerSecond,
    competitorOpsPerSecond: mixed.competitorOpsPerSecond,
    ratio: mixed.ratio,
    comparedValues: agreement.agreedValues.length,
    disagreedValues: agreement.disagreements.length,
    luqSpreadPercent: mixed.luqSpreadPercent,
    competitorSpreadPercent: mixed.competitorSpreadPercent,
    accepted: timePool(agreement.acceptedAgreed, validator, check, expected),
    rejected: timePool(agreement.rejectedAgreed, validator, check, expected),
  };
}
