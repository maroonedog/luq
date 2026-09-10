// ===========================================================================
// bench/record-ratio-figures.ts — the two sections CI acts on.
//
// referenceRatio[] carries the floors the gate fails below. referenceWork[]
// carries the evidence that the denominator of each of those ratios is a
// program that runs, which is a section this file has because the harness once
// gated for months on a reference V8 had deleted.
//
// FLOORS ARE STICKY. A recorded floor is kept across re-records unless
// `recalibrateFloors` is asked for explicitly. Without that rule the response
// to a regression is to re-run the recorder: the floor drops to match, the
// gate goes green, and a command that looked like housekeeping has converted
// the gate into a rubber stamp.
// ===========================================================================
import { measureThroughputRatio } from "./measure-throughput-ratio";
import { measureReferenceWork } from "./measure-reference-work";
import { findRecordedFloor, readPerfBaseline } from "./read-perf-baseline";
import { RATIO_CASES } from "./ratio-case";
import { roundTo } from "./round-to";
import { BENCH_SHAPES } from "./shapes/index";
import type {
  PerfBaseline,
  ReferenceRatioRecord,
  ReferenceWorkRecord,
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
 * What 25% of margin does and does not detect is measured rather than assumed,
 * and written into the recorded file as `gateSensitivity` (see
 * bench/gate-sensitivity.ts). Read it before treating a green gate as proof:
 * it sees a slowdown of a third and it does not see a slowdown of a sixth.
 */
const FIRST_FLOOR_FRACTION = 0.75;

/**
 * The shapes kept off the ratio gate.
 *
 * On singleField the reference's own work is a couple of nanoseconds per call,
 * the same order as the harness's own loop overhead. The ratio then stops
 * meaning "luq against a hand-written validator" and starts meaning "luq
 * against the harness's loop". The canary that watches for this leaves far
 * less headroom on singleField than on any other shape, and has fired in CI.
 * It is a measurement floor, not a threshold to tune. The absolute figures
 * stay in throughput[].
 *
 * **This lives in the recorder because it used to be a hand edit of the
 * recorded file.** An exclusion deleted by hand comes back silently the next
 * time the recording runs, and it did. Kept here, re-recording cannot lose it.
 */
const SHAPES_OUTSIDE_THE_RATIO_GATE: readonly string[] = ["singleField"];

export interface RecordOptions {
  readonly recalibrateFloors?: boolean;
}

function readPreviousBaseline(): PerfBaseline | undefined {
  try {
    return readPerfBaseline();
  } catch {
    return undefined;
  }
}

export function measureRatioRecords(
  options: RecordOptions
): readonly ReferenceRatioRecord[] {
  const previous = readPreviousBaseline();
  const records: ReferenceRatioRecord[] = [];
  for (const shape of BENCH_SHAPES) {
    if (SHAPES_OUTSIDE_THE_RATIO_GATE.includes(shape.name)) continue;
    for (const ratioCase of RATIO_CASES) {
      const measured = measureThroughputRatio(shape, ratioCase);
      const kept =
        options.recalibrateFloors === true || previous === undefined
          ? undefined
          : findRecordedFloor(previous, shape.name, ratioCase);
      records.push({
        shape: measured.shape,
        operation: measured.operation,
        inputIsAccepted: measured.inputIsAccepted,
        luqOpsPerSecond: Math.round(measured.luqOpsPerSecond),
        referenceOpsPerSecond: Math.round(measured.referenceOpsPerSecond),
        ratio: roundTo(measured.ratio, 4),
        ratioFloor: kept ?? roundTo(measured.ratio * FIRST_FLOOR_FRACTION, 4),
        luqSpreadPercent: roundTo(measured.luqSpreadPercent, 1),
        referenceSpreadPercent: roundTo(measured.referenceSpreadPercent, 1),
        ratioSpreadPercent: roundTo(measured.ratioSpreadPercent, 1),
        isQuiet: measured.isQuiet,
      });
    }
  }
  return records;
}

/**
 * One record per (shape, pool). The parse cases are skipped because they use
 * the accepted pool and the same reference as validate does, so their canary
 * figure is the validate one measured twice.
 */
export function measureReferenceWorkRecords(): readonly ReferenceWorkRecord[] {
  const records: ReferenceWorkRecord[] = [];
  for (const shape of BENCH_SHAPES) {
    for (const ratioCase of RATIO_CASES) {
      if (ratioCase.operation === "parse") continue;
      const work = measureReferenceWork(shape, ratioCase);
      records.push({
        shape: work.shape,
        inputIsAccepted: work.inputIsAccepted,
        harnessFloorOpsPerSecond: Math.round(work.harnessFloorOpsPerSecond),
        referenceOpsPerSecond: Math.round(work.referenceOpsPerSecond),
        shareOfFloor: roundTo(work.shareOfFloor, 3),
        netNanosecondsPerCall: roundTo(work.netNanosecondsPerCall, 2),
      });
    }
  }
  return records;
}
