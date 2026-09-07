// ===========================================================================
// bench/record-perf-baseline.ts
//
// Assembles the whole of config/perf-baseline.json in one run, on one machine,
// so that every figure in the file was measured under the same conditions and
// two of them can honestly be compared. The measuring is done by
// record-absolute-figures.ts (throughput, build cost) and
// record-ratio-figures.ts (the floors CI gates on, and the evidence that their
// denominators run); this file only states the conditions and puts the
// sections together.
//
// Floors are sticky across re-records — see record-ratio-figures.ts for why —
// so the only reason to pass `--recalibrate-floors` is that the DENOMINATOR
// changed. It did once: the hand-written references now rotate over a pool of
// values (they were being deleted by the optimiser on one shape), their
// e-mail, UUID, date-time and SKU patterns now match the plugins they stand in
// for, and the gate covers parse and the rejection path as well as validate.
// Floors carried over from before those changes would be floors on a different
// measurement.
// ===========================================================================
import { measureLegacyComparison } from "./measure-legacy-throughput";
import { describeMachine } from "./describe-machine";
import {
  measureBuildCostRecords,
  measureThroughputRecords,
} from "./record-absolute-figures";
import {
  measureRatioRecords,
  measureReferenceWorkRecords,
  type RecordOptions,
} from "./record-ratio-figures";
import { GATE_SENSITIVITY } from "./gate-sensitivity";
import { roundTo } from "./round-to";
import { ARRAY_ELEMENT_COUNT, BENCH_SHAPES } from "./shapes/index";
import type { PerfBaseline } from "./perf-baseline.types";

export type { RecordOptions } from "./record-ratio-figures";

const INPUT_ROTATION =
  "every subject rotates over a pool of at least four distinct values (bench/rotate-over-values.ts); one frozen value let V8 delete the singleField reference outright";

const MODULE_UNDER_TEST =
  "src/ transpiled by ts-node (CommonJS, ES2020) — not the bundled dist";

export function recordPerfBaseline(options: RecordOptions = {}): PerfBaseline {
  return {
    recordedAt: new Date().toISOString(),
    machine: describeMachine(),
    conditions: {
      abortEarly: true,
      inputIsAccepted: true,
      inputRotation: INPUT_ROTATION,
      arrayElementCount: ARRAY_ELEMENT_COUNT,
      moduleUnderTest: MODULE_UNDER_TEST,
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
    referenceWork: measureReferenceWorkRecords(),
    gateSensitivity: GATE_SENSITIVITY,
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
