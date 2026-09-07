// ===========================================================================
// bench/gate-throughput-ratio.ts — the CI gate itself.
//
// For every shape with a recorded floor, measure luq_ops / reference_ops now,
// in this process, and fail below the floor. Nothing absolute is compared, so
// a slow runner does not fail the build; a change that made the ENGINE slower
// relative to hand-written code does.
//
// The gate refuses to run without a recorded baseline (readPerfBaseline
// throws). That is deliberate: the failure mode a ratio gate invites is
// becoming a no-op — no floors, nothing to compare, green forever — and a
// green no-op gate is how the 1.x performance claims survived being wrong.
// ===========================================================================
import { measureThroughputRatio } from "./measure-throughput-ratio";
import { readPerfBaseline } from "./read-perf-baseline";
import { BENCH_SHAPES } from "./shapes/index";
import type { ThroughputOptions } from "./measure-throughput";
import type { BenchShapeName } from "./shapes/bench-shape.types";

export interface GateOutcome {
  readonly shape: BenchShapeName;
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
    baseline.referenceRatio.map((entry) => [entry.shape, entry.ratioFloor])
  );

  const outcomes: GateOutcome[] = [];
  for (const shape of BENCH_SHAPES) {
    const ratioFloor = floors.get(shape.name);
    if (ratioFloor === undefined) continue;
    const measured = measureThroughputRatio(shape, options);
    outcomes.push({
      shape: shape.name,
      ratio: measured.ratio,
      ratioFloor,
      passed: measured.ratio >= ratioFloor,
      luqOpsPerSecond: measured.luqOpsPerSecond,
      referenceOpsPerSecond: measured.referenceOpsPerSecond,
    });
  }

  if (outcomes.length === 0) {
    throw new Error(
      "the ratio gate measured nothing: no recorded floor matched any benchmark shape"
    );
  }

  return {
    outcomes,
    failures: outcomes.filter((outcome) => !outcome.passed),
    recordedAt: baseline.recordedAt,
  };
}
