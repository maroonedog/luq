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
  /** True of throughput[] and buildCost[]. referenceRatio[] says per record. */
  readonly inputIsAccepted: boolean;
  /** How the subject gets its argument. Not decoration: see referenceWork[]. */
  readonly inputRotation: string;
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
  /** validate or parse. parse was recorded but never gated until now. */
  readonly operation: "validate" | "parse";
  /** false means the pool is rejectedValues: the abortEarly failure path. */
  readonly inputIsAccepted: boolean;
  readonly luqOpsPerSecond: number;
  readonly referenceOpsPerSecond: number;
  readonly ratio: number;
  /** The CI gate fails below this. Calibrated from a recorded run. */
  readonly ratioFloor: number;
  /**
   * Run-to-run noise on each side, so the floor's margin can be judged.
   *
   * null means "not measured". The CI floors were recovered from ratios in a
   * run log, which carries no spread; writing 0 would claim there was no
   * variance. A real figure lands here once recording can run in CI.
   */
  readonly luqSpreadPercent: number | null;
  readonly referenceSpreadPercent: number | null;
  /** Spread of the interleaved per-pair ratios: what the floor answers to. */
  readonly ratioSpreadPercent: number | null;
  /** null: with no spread, whether the run was quiet cannot be decided. */
  readonly isQuiet: boolean | null;
}

/**
 * Evidence that the denominator of every ratio above is a program that runs.
 * Recorded because the alternative is trusting it: the singleField reference
 * was folded away by V8 for the whole life of the previous baseline, and the
 * only way to see it in the file was that no figure in the file could show it.
 */
export interface ReferenceWorkRecord {
  readonly shape: BenchShapeName;
  /** Which pool: the accepted one or the abortEarly rejection one. */
  readonly inputIsAccepted: boolean;
  /** The identical rotation with the check replaced by `() => true`. */
  readonly harnessFloorOpsPerSecond: number;
  readonly referenceOpsPerSecond: number;
  /** reference / floor. Anything near 1 means the reference is not running. */
  readonly shareOfFloor: number;
  /** Reference cost minus the rotation's own cost. Must be positive. */
  readonly netNanosecondsPerCall: number;
}

/**
 * What the gate actually detects, measured by mutation rather than asserted.
 * Recorded so that nobody reads a passing gate as "no regression": a floor set
 * at 75% of a recorded ratio cannot see a regression smaller than a quarter,
 * and saying so in the file is cheaper than someone rediscovering it.
 */
export interface GateSensitivityRecord {
  readonly method: string;
  /** Slowdowns at or above this failed every gated pairing when measured. */
  readonly caughtSlowdownPercent: number;
  /** Slowdowns at or below this passed most pairings when measured. */
  readonly missedSlowdownPercent: number;
  readonly measuredAt: string;
  readonly detail: readonly string[];
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
  readonly referenceWork: readonly ReferenceWorkRecord[];
  readonly gateSensitivity: GateSensitivityRecord;
  readonly legacyComparison: readonly LegacyComparisonRecord[];
}
