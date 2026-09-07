// ===========================================================================
// bench/legacy/compare-implementations.ts — THE CHILD PROCESS.
//
// Measures 1.x and the rewrite for each shape, back to back, in one process,
// and prints one JSON line. It is a separate process from the rest of the
// harness for one reason: requiring the 1.x sources needs ts-node in
// transpile-only mode (they do not survive this repo's true-strict tsconfig,
// and typechecking them is not what is being measured), and turning
// typechecking off for the whole bench run would be a silent loss of a gate.
//
// Everything that could make the comparison dishonest is checked before a
// figure is produced: the entry must carry 1.x-only exports, and BOTH sides
// must accept the same value. A legacy validator that quietly rejects the
// input would otherwise be measured on its failure path and look fast.
// ===========================================================================
import { measureThroughput } from "../measure-throughput";
import { BENCH_SHAPES } from "../shapes/index";
import { LEGACY_SHAPES } from "./legacy-shapes";
import { loadLegacyEntry } from "./load-legacy-entry";
import type { LegacyOutcome } from "./legacy-build.types";
import { COMPARISON_MARKER } from "./comparison-marker";
import type { LegacyComparisonRecord } from "../perf-baseline.types";

const SAME_CONDITIONS_NOTE =
  "1.x src and rewritten src, both ts-node transpiled, measured back to back in one process on one machine";

/** 1.x returns `{ _data }` on success and `{ valid: false, errors }` on
 * failure, so "accepted" is "did not say false", not "said true". */
function isAccepted(outcome: LegacyOutcome): boolean {
  return outcome.valid !== false;
}

function compareOneShape(
  sourceRoot: string
): readonly LegacyComparisonRecord[] {
  const legacy = loadLegacyEntry(sourceRoot);

  return BENCH_SHAPES.map((shape) => {
    const currentValidator = shape.buildValidator();
    const current = measureThroughput(
      `${shape.name}:current`,
      () => currentValidator.validate(shape.acceptedValue).valid
    );
    const unmeasured = {
      shape: shape.name,
      legacyOpsPerSecond: null,
      currentOpsPerSecond: current.opsPerSecond,
      speedup: null,
    } as const;

    if (!legacy.available) {
      return { ...unmeasured, note: `not comparable: ${legacy.detail}` };
    }
    const legacyShape = LEGACY_SHAPES.find(
      (candidate) => candidate.name === shape.name
    );
    if (legacyShape === undefined) {
      return {
        ...unmeasured,
        note: "not comparable: shape-not-expressible in the 1.x API",
      };
    }

    try {
      const legacyValidator = legacyShape.buildValidator(legacy);
      if (!isAccepted(legacyValidator.validate(legacyShape.acceptedValue))) {
        return {
          ...unmeasured,
          note: "not comparable: 1.x REJECTS the value the rewrite accepts, so the two are not validating the same thing",
        };
      }
      const measured = measureThroughput(`${shape.name}:legacy`, () =>
        isAccepted(legacyValidator.validate(legacyShape.acceptedValue))
      );
      return {
        shape: shape.name,
        legacyOpsPerSecond: measured.opsPerSecond,
        currentOpsPerSecond: current.opsPerSecond,
        speedup: current.opsPerSecond / measured.opsPerSecond,
        note: SAME_CONDITIONS_NOTE,
      };
    } catch (failure) {
      const detail =
        failure instanceof Error ? failure.message : String(failure);
      return { ...unmeasured, note: `not comparable: ${detail}` };
    }
  });
}

const sourceRootArgument = process.argv[2];
if (sourceRootArgument === undefined) {
  process.stderr.write("usage: compare-implementations <1.x-src-root>\n");
  process.exitCode = 2;
} else {
  const records = compareOneShape(sourceRootArgument);
  process.stdout.write(`${COMPARISON_MARKER}${JSON.stringify(records)}\n`);
}
