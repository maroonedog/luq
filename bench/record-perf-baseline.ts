// ===========================================================================
// bench/record-perf-baseline.ts
//
// Produces the whole of config/perf-baseline.json in one run, on one machine,
// so that every figure in the file was measured under the same conditions and
// two of them can honestly be compared.
//
// FLOORS ARE STICKY. A recorded floor is kept across re-records unless
// `recalibrateFloors` is asked for explicitly. Without that rule, the response
// to a performance regression is to re-run the recorder — the floor drops to
// match the regression, the gate goes green, and the gate has been converted
// into a rubber stamp by a command that looked like housekeeping.
// ===========================================================================
import { measureThroughput } from "./measure-throughput";
import { measureThroughputRatio } from "./measure-throughput-ratio";
import { measureBuildCost } from "./measure-build-cost";
import { measureLegacyComparison } from "./measure-legacy-throughput";
import { describeMachine } from "./describe-machine";
import { findRecordedFloor, readPerfBaseline } from "./read-perf-baseline";
import { ARRAY_ELEMENT_COUNT, BENCH_SHAPES } from "./shapes/index";
import type {
  BuildCostRecord,
  PerfBaseline,
  ReferenceRatioRecord,
  ThroughputRecord,
} from "./perf-baseline.types";

/**
 * A first floor is set at 75% of the ratio measured on the recording machine.
 *
 * The margin is calibrated from measurements, not guessed, and the calibration
 * was redone once because the first one was measuring the harness rather than
 * the code. With the two sides measured SEQUENTIALLY, the gate run four times
 * back to back produced singleField 0.0089-0.0112 and array 0.0239-0.0375 — a
 * 1.57x swing on the array shape — which forced a floor so low it would have
 * missed real regressions. With the two sides INTERLEAVED (see
 * take-interleaved-samples.ts) the same four runs produced singleField
 * 0.0131-0.0135 and array 0.0302-0.0314: a swing of about 4%.
 *
 * 25% of margin against 4% of observed noise leaves the gate quiet on a busy
 * runner while still failing a regression of a third. Verified by mutation: an
 * engine made 2x slower fails every one of the five shapes.
 */
const FIRST_FLOOR_FRACTION = 0.75;

export interface RecordOptions {
  readonly recalibrateFloors?: boolean;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function measureThroughputRecords(): readonly ThroughputRecord[] {
  const records: ThroughputRecord[] = [];
  for (const shape of BENCH_SHAPES) {
    const validator = shape.buildValidator();
    const validated = measureThroughput(
      `${shape.name}:validate`,
      () => validator.validate(shape.acceptedValue).valid
    );
    const parsed = measureThroughput(
      `${shape.name}:parse`,
      () => validator.parse(shape.acceptedValue).valid
    );
    records.push(
      {
        shape: shape.name,
        operation: "validate",
        opsPerSecond: Math.round(validated.opsPerSecond),
        relativeSpreadPercent: roundTo(validated.relativeSpreadPercent, 1),
        isQuiet: validated.isQuiet,
      },
      {
        shape: shape.name,
        operation: "parse",
        opsPerSecond: Math.round(parsed.opsPerSecond),
        relativeSpreadPercent: roundTo(parsed.relativeSpreadPercent, 1),
        isQuiet: parsed.isQuiet,
      }
    );
  }
  return records;
}

function measureBuildCostRecords(): readonly BuildCostRecord[] {
  return BENCH_SHAPES.map((shape) => {
    const measured = measureBuildCost(shape);
    return {
      shape: measured.shape,
      buildsPerSecond: Math.round(measured.buildsPerSecond),
      microsecondsPerBuild: roundTo(measured.microsecondsPerBuild, 2),
      validateCallsPerBuild: Math.round(measured.validateCallsPerBuild),
      costRatioSpreadPercent: roundTo(measured.costRatioSpreadPercent, 1),
      isQuiet: measured.isQuiet,
    };
  });
}

function measureRatioRecords(
  options: RecordOptions
): readonly ReferenceRatioRecord[] {
  let previous: PerfBaseline | undefined;
  try {
    previous = readPerfBaseline();
  } catch {
    previous = undefined;
  }

  return BENCH_SHAPES.map((shape) => {
    const measured = measureThroughputRatio(shape);
    const kept =
      options.recalibrateFloors === true || previous === undefined
        ? undefined
        : findRecordedFloor(previous, shape.name);
    return {
      shape: measured.shape,
      luqOpsPerSecond: Math.round(measured.luqOpsPerSecond),
      referenceOpsPerSecond: Math.round(measured.referenceOpsPerSecond),
      ratio: roundTo(measured.ratio, 4),
      ratioFloor: kept ?? roundTo(measured.ratio * FIRST_FLOOR_FRACTION, 4),
      luqSpreadPercent: roundTo(measured.luqSpreadPercent, 1),
      referenceSpreadPercent: roundTo(measured.referenceSpreadPercent, 1),
      ratioSpreadPercent: roundTo(measured.ratioSpreadPercent, 1),
      isQuiet: measured.isQuiet,
    };
  });
}

export function recordPerfBaseline(options: RecordOptions = {}): PerfBaseline {
  return {
    recordedAt: new Date().toISOString(),
    machine: describeMachine(),
    conditions: {
      abortEarly: true,
      inputIsAccepted: true,
      arrayElementCount: ARRAY_ELEMENT_COUNT,
      moduleUnderTest:
        "src/ transpiled by ts-node (CommonJS, ES2020) — not the bundled dist",
      sampleCount: 9,
      targetSampleMs: 120,
    },
    shapes: BENCH_SHAPES.map((shape) => ({
      name: shape.name,
      declares: shape.declares,
    })),
    throughput: measureThroughputRecords(),
    buildCost: measureBuildCostRecords(),
    referenceRatio: measureRatioRecords(options),
    legacyComparison: measureLegacyComparison().map((entry) => ({
      shape: entry.shape,
      legacyOpsPerSecond:
        entry.legacyOpsPerSecond === null
          ? null
          : Math.round(entry.legacyOpsPerSecond),
      currentOpsPerSecond: Math.round(entry.currentOpsPerSecond),
      speedup: entry.speedup === null ? null : roundTo(entry.speedup, 2),
      note: entry.note,
    })),
  };
}
