// ===========================================================================
// bench/gate-throughput-ratio.ts — the CI gate itself.
//
// For every (shape, case) pairing with a recorded floor, measure
// luq_ops / reference_ops now, in this process, and fail below the floor.
// Nothing absolute is compared, so a slow runner does not fail the build; a
// change that made the ENGINE slower relative to hand-written code does.
//
// "Case" is new and it is the larger half of this file's coverage: validate on
// an accepted value was the only thing gated before, so parse — the operation
// that runs transforms over a copy-on-write structure — and the abortEarly
// rejection path could both regress without any number moving.
//
// The gate refuses to run without a recorded baseline (readPerfBaseline
// throws). That is deliberate: the failure mode a ratio gate invites is
// becoming a no-op — no floors, nothing to compare, green forever — and a
// green no-op gate is how the 1.x performance claims survived being wrong.
// The same reasoning is why measureThroughputRatio now refuses to produce a
// figure until the reference has been shown to agree with Luq and to be
// executing at all.
// ===========================================================================
import { measureThroughputRatio } from "./measure-throughput-ratio";
import { readPerfBaseline } from "./read-perf-baseline";
import { RATIO_CASES, describeRatioCase } from "./ratio-case";
import { BENCH_SHAPES } from "./shapes/index";
import type { ThroughputOptions } from "./measure-throughput";
import type { BenchShapeName } from "./shapes/bench-shape.types";

export interface GateOutcome {
  readonly shape: BenchShapeName;
  readonly ratioCase: string;
  readonly ratio: number;
  readonly ratioFloor: number;
  readonly passed: boolean;
  readonly luqOpsPerSecond: number;
  readonly referenceOpsPerSecond: number;
}

export interface GateReport {
  readonly outcomes: readonly GateOutcome[];
  readonly failures: readonly GateOutcome[];
  readonly recordedAt: string;
}

export function gateThroughputRatio(options?: ThroughputOptions): GateReport {
  const baseline = readPerfBaseline();
  const floors = new Map(
    baseline.referenceRatio.map((entry) => [
      `${entry.shape}:${entry.operation}:${String(entry.inputIsAccepted)}`,
      entry.ratioFloor,
    ])
  );

  const outcomes: GateOutcome[] = [];
  for (const shape of BENCH_SHAPES) {
    for (const ratioCase of RATIO_CASES) {
      const ratioFloor = floors.get(
        `${shape.name}:${ratioCase.operation}:${String(ratioCase.inputIsAccepted)}`
      );
      if (ratioFloor === undefined) continue;
      const measured = measureThroughputRatio(shape, ratioCase, options);
      outcomes.push({
        shape: shape.name,
        ratioCase: describeRatioCase(ratioCase),
        ratio: measured.ratio,
        ratioFloor,
        passed: measured.ratio >= ratioFloor,
        luqOpsPerSecond: measured.luqOpsPerSecond,
        referenceOpsPerSecond: measured.referenceOpsPerSecond,
      });
    }
  }

  if (outcomes.length === 0) {
    throw new Error(
      "the ratio gate measured nothing: no recorded floor matched any benchmark shape and case"
    );
  }

  return {
    outcomes,
    failures: outcomes.filter((outcome) => !outcome.passed),
    recordedAt: baseline.recordedAt,
  };
}
