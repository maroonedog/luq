// ===========================================================================
// bench/legacy/compare-implementations.ts — THE CHILD PROCESS.
//
// Measures 1.x and the rewrite for each shape, INTERLEAVED sample by sample in
// one process, and prints one JSON line. It is a separate process from the
// rest of the harness for one reason: requiring the 1.x sources needs ts-node
// in transpile-only mode (they do not survive this repo's true-strict
// tsconfig, and typechecking them is not what is being measured), and turning
// typechecking off for the whole bench run would be a silent loss of a gate.
//
// The speedup is a RATIO, so it is taken the way this harness takes ratios.
// The previous version measured all of 1.x and then all of the rewrite, which
// is the sequential method take-interleaved-samples.ts records as having
// invented a 4.6x regression that did not exist.
//
// Everything that could make the comparison dishonest is checked before a
// figure is produced: the entry must carry 1.x-only exports, both sides must
// ACCEPT the same values, and — new, and the half that has teeth — 1.x must
// REJECT the values the rewrite rejects. A legacy validator that quietly
// accepted or quietly rejected everything would otherwise be measured on the
// wrong path and look fast.
// ===========================================================================
import { estimateRate, median } from "../sample-rate";
import { takeInterleavedSamples } from "../take-interleaved-samples";
import { measureThroughput } from "../measure-throughput";
import {
  DEFAULT_SAMPLE_COUNT,
  DEFAULT_TARGET_SAMPLE_MS,
  DEFAULT_WARMUP_MS,
} from "../measure-throughput";
import { rotateOverValues } from "../rotate-over-values";
import { BENCH_SHAPES } from "../shapes/index";
import { LEGACY_SHAPES } from "./legacy-shapes";
import { loadLegacyEntry } from "./load-legacy-entry";
import type { LegacyOutcome, LegacyValidator } from "./legacy-build.types";
import { COMPARISON_MARKER } from "./comparison-marker";
import type { LegacyComparisonRecord } from "../perf-baseline.types";
import type { BenchShape } from "../shapes/bench-shape.types";

const SAME_CONDITIONS_NOTE =
  "1.x src and rewritten src, both ts-node transpiled, interleaved sample by sample in one process on one machine";

const INTERLEAVED_OPTIONS = {
  targetSampleMs: DEFAULT_TARGET_SAMPLE_MS,
  sampleCount: DEFAULT_SAMPLE_COUNT,
  warmupMs: DEFAULT_WARMUP_MS,
};

/** 1.x returns `{ _data }` on success and `{ valid: false, errors }` on
 * failure, so "accepted" is "did not say false", not "said true". */
function isAccepted(outcome: LegacyOutcome): boolean {
  return outcome.valid !== false;
}

/**
 * The negative half. Without it the only thing asserted about 1.x is that it
 * said yes to a valid value, which a validator that says yes to everything
 * also does — and a validator that says yes to everything is very fast.
 */
function findValueLegacyFailsToReject(
  legacyValidator: LegacyValidator,
  shape: BenchShape
): number | undefined {
  for (let index = 0; index < shape.rejectedValues.length; index += 1) {
    const value = shape.rejectedValues[index];
    if (isAccepted(legacyValidator.validate(value))) return index;
  }
  return undefined;
}

function compareOneShape(
  sourceRoot: string
): readonly LegacyComparisonRecord[] {
  const legacy = loadLegacyEntry(sourceRoot);

  return BENCH_SHAPES.map((shape) => {
    const currentValidator = shape.buildValidator();
    const currentSubject = rotateOverValues(
      shape.acceptedValues,
      (value) => currentValidator.validate(value).valid
    );

    if (!legacy.available) {
      return {
        ...measureCurrentAlone(shape.name, currentSubject),
        note: `not comparable: ${legacy.detail}`,
      };
    }
    const legacyShape = LEGACY_SHAPES.find(
      (candidate) => candidate.name === shape.name
    );
    if (legacyShape === undefined) {
      return {
        ...measureCurrentAlone(shape.name, currentSubject),
        note: "not comparable: shape-not-expressible in the 1.x API",
      };
    }

    try {
      const legacyValidator = legacyShape.buildValidator(legacy);
      if (!isAccepted(legacyValidator.validate(shape.acceptedValue))) {
        return {
          ...measureCurrentAlone(shape.name, currentSubject),
          note: "not comparable: 1.x REJECTS the value the rewrite accepts, so the two are not validating the same thing",
        };
      }
      const unrejected = findValueLegacyFailsToReject(legacyValidator, shape);
      if (unrejected !== undefined) {
        return {
          ...measureCurrentAlone(shape.name, currentSubject),
          note: `not comparable: 1.x ACCEPTS rejectedValues[${unrejected}], which the rewrite rejects, so the two are not validating the same language`,
        };
      }

      const legacySubject = rotateOverValues(shape.acceptedValues, (value) =>
        isAccepted(legacyValidator.validate(value))
      );
      const samples = takeInterleavedSamples(
        currentSubject,
        legacySubject,
        INTERLEAVED_OPTIONS
      );
      if (
        samples.firstAccepted !==
          samples.firstIterations * samples.sampleCount ||
        samples.secondAccepted !==
          samples.secondIterations * samples.sampleCount
      ) {
        return {
          ...measureCurrentAlone(shape.name, currentSubject),
          note: "not comparable: one side stopped accepting the pool part-way through the measurement",
        };
      }
      return {
        shape: shape.name,
        legacyOpsPerSecond: estimateRate(samples.secondRates),
        currentOpsPerSecond: estimateRate(samples.firstRates),
        speedup: median(samples.pairRatios),
        note: SAME_CONDITIONS_NOTE,
      };
    } catch (failure) {
      const detail =
        failure instanceof Error ? failure.message : String(failure);
      return {
        ...measureCurrentAlone(shape.name, currentSubject),
        note: `not comparable: ${detail}`,
      };
    }
  });
}

function measureCurrentAlone(
  shape: BenchShape["name"],
  subject: () => boolean
): Omit<LegacyComparisonRecord, "note"> {
  const current = measureThroughput(`${shape}:current`, subject);
  return {
    shape,
    legacyOpsPerSecond: null,
    currentOpsPerSecond: current.opsPerSecond,
    speedup: null,
  };
}

const sourceRootArgument = process.argv[2];
if (sourceRootArgument === undefined) {
  process.stderr.write("usage: compare-implementations <1.x-src-root>\n");
  process.exitCode = 2;
} else {
  const records = compareOneShape(sourceRootArgument);
  process.stdout.write(`${COMPARISON_MARKER}${JSON.stringify(records)}\n`);
}
