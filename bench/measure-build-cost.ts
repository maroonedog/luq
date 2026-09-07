// ===========================================================================
// bench/measure-build-cost.ts
//
// THE NUMBER THAT TESTS THE CENTRAL DESIGN CLAIM.
//
// The design says: everything knowable is computed at build() time — paths are
// parsed into readers, rules are compiled into closures, array fields are
// grouped — so that validate() is nothing but running an already-assembled
// function. That claim has an observable consequence, and this file measures
// it: build() must be EXPENSIVE and validate() must be CHEAP, and
// `validateCallsPerBuild` must be large. If the two cost the same, the
// pre-computation is not happening and the architecture is decoration.
//
// The two are measured INTERLEAVED, one sample of each in turn, because
// `validateCallsPerBuild` is a ratio and a ratio taken across two separated
// halves is at the mercy of whatever else the machine was doing in between. A
// sequential version of this measurement reported 114 calls per build for the
// jsonSchema shape on a quiet run and 477 on a busy one, from the same code.
//
// It is also the evidence for the advice 1.x gave on three documentation pages
// — "build once, reuse the validator" — which it asserted and never measured.
// ===========================================================================
import {
  DEFAULT_ATTEMPTS,
  DEFAULT_MAX_SPREAD_PERCENT,
  DEFAULT_SAMPLE_COUNT,
  DEFAULT_TARGET_SAMPLE_MS,
  DEFAULT_WARMUP_MS,
} from "./measure-throughput";
import { estimateRate, median, relativeSpreadPercent } from "./sample-rate";
import { takeInterleavedSamples } from "./take-interleaved-samples";
import { rotateOverValues } from "./rotate-over-values";
import type { BenchShape } from "./shapes/bench-shape.types";
import type { BuildCostRecord } from "./perf-baseline.types";

const MICROSECONDS_PER_SECOND = 1e6;
/** build() is far slower than validate(), so it needs a longer sample. */
const BUILD_TARGET_SAMPLE_MS = 200;

/**
 * build() is measured by running the WHOLE builder chain each iteration —
 * what a caller who rebuilds per request pays. validate() is measured on a
 * validator built once, which is what the documentation tells them to do.
 */
function measureBuildCostOnce(shape: BenchShape): BuildCostRecord {
  const reusedValidator = shape.buildValidator();

  const samples = takeInterleavedSamples(
    () => typeof shape.buildValidator().validate === "function",
    rotateOverValues(
      shape.acceptedValues,
      (value) => reusedValidator.validate(value).valid
    ),
    {
      targetSampleMs: BUILD_TARGET_SAMPLE_MS,
      sampleCount: DEFAULT_SAMPLE_COUNT,
      warmupMs: DEFAULT_WARMUP_MS,
    }
  );

  if (
    samples.secondAccepted !==
    samples.secondIterations * samples.sampleCount
  ) {
    throw new Error(
      `${shape.name}: validate() rejected the accepted value while measuring build cost`
    );
  }

  const buildsPerSecond = estimateRate(samples.firstRates);
  // pairRatios is build/validate per pair; the median inverts exactly.
  const buildOverValidate = median(samples.pairRatios);
  const costRatioSpread = relativeSpreadPercent(
    samples.pairRatios,
    buildOverValidate
  );
  return {
    shape: shape.name,
    buildsPerSecond,
    microsecondsPerBuild: MICROSECONDS_PER_SECOND / buildsPerSecond,
    validateCallsPerBuild: 1 / buildOverValidate,
    costRatioSpreadPercent: costRatioSpread,
    isQuiet: costRatioSpread <= DEFAULT_MAX_SPREAD_PERCENT,
  };
}

/**
 * Re-measures a noisy pairing and keeps the least disturbed attempt, the same
 * rule the throughput and ratio measurements apply. `isQuiet` still reports
 * honestly when no attempt got under the limit.
 */
export function measureBuildCost(shape: BenchShape): BuildCostRecord {
  let best = measureBuildCostOnce(shape);
  for (
    let attempt = 1;
    !best.isQuiet && attempt < DEFAULT_ATTEMPTS;
    attempt += 1
  ) {
    const retried = measureBuildCostOnce(shape);
    if (retried.costRatioSpreadPercent < best.costRatioSpreadPercent) {
      best = retried;
    }
  }
  return best;
}

/** Re-exported so the recorder states the same conditions it measured under. */
export const BUILD_COST_CONDITIONS = Object.freeze({
  targetSampleMs: BUILD_TARGET_SAMPLE_MS,
  sampleCount: DEFAULT_SAMPLE_COUNT,
  warmupMs: DEFAULT_WARMUP_MS,
  defaultTargetSampleMs: DEFAULT_TARGET_SAMPLE_MS,
});
