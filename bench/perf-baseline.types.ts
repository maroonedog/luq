// ===========================================================================
// bench/perf-baseline.types.ts — the shape of config/perf-baseline.json.
//
// The file is the SINGLE SOURCE for every performance number the project
// publishes. 1.x is the reason: its README said "1.2M ops/sec (simple), 43K
// ops/sec (complex)" while its own benchmarks page, generated from a results
// file, said 694,692 and 35,946 — the prose had been typed by hand and then
// drifted (docs/legacy-spec/documented-promises.md:274). Prose that quotes a
// number must read it from here.
//
// `ratioFloor` lives in the same file because the CI gate is the one consumer
// that must not be edited by hand either: a floor is only legitimate if it was
// derived from a recorded run on a named machine.
// ===========================================================================
import type { BenchShapeName } from "./shapes/bench-shape.types";

export interface MachineDescription {
  readonly cpuModel: string;
  readonly logicalCores: number;
  readonly platform: string;
  readonly arch: string;
  readonly nodeVersion: string;
  readonly totalMemoryGb: number;
}

/** Everything that changes the meaning of a figure. */
export interface BenchConditions {
  readonly abortEarly: boolean;
  readonly inputIsAccepted: boolean;
  readonly arrayElementCount: number;
  readonly moduleUnderTest: string;
  readonly sampleCount: number;
  readonly targetSampleMs: number;
}

export interface ThroughputRecord {
  readonly shape: BenchShapeName;
  readonly operation: "validate" | "parse";
  readonly opsPerSecond: number;
  readonly relativeSpreadPercent: number;
  /** False when the recording machine stayed noisy: quote this figure with care. */
  readonly isQuiet: boolean;
}

export interface BuildCostRecord {
  readonly shape: BenchShapeName;
  readonly buildsPerSecond: number;
  readonly microsecondsPerBuild: number;
  /** buildCost / validateCost. How many validate() calls one build() buys. */
  readonly validateCallsPerBuild: number;
  /** Spread of the interleaved per-pair build/validate ratios. */
  readonly costRatioSpreadPercent: number;
  readonly isQuiet: boolean;
}

export interface ReferenceRatioRecord {
  readonly shape: BenchShapeName;
  readonly luqOpsPerSecond: number;
  readonly referenceOpsPerSecond: number;
  readonly ratio: number;
  /** The CI gate fails below this. Calibrated from a recorded run. */
  readonly ratioFloor: number;
  /** Run-to-run noise on each side, so the floor's margin can be judged. */
  readonly luqSpreadPercent: number;
  readonly referenceSpreadPercent: number;
  /** Spread of the interleaved per-pair ratios: what the floor answers to. */
  readonly ratioSpreadPercent: number;
  readonly isQuiet: boolean;
}

export interface LegacyComparisonRecord {
  readonly shape: BenchShapeName;
  readonly legacyOpsPerSecond: number | null;
  readonly currentOpsPerSecond: number;
  readonly speedup: number | null;
  /** Why a null figure is null, or why the two are comparable. */
  readonly note: string;
}

export interface PerfBaseline {
  readonly recordedAt: string;
  readonly machine: MachineDescription;
  readonly conditions: BenchConditions;
  readonly shapes: readonly {
    readonly name: BenchShapeName;
    readonly declares: string;
  }[];
  readonly throughput: readonly ThroughputRecord[];
  readonly buildCost: readonly BuildCostRecord[];
  readonly referenceRatio: readonly ReferenceRatioRecord[];
  readonly legacyComparison: readonly LegacyComparisonRecord[];
}
