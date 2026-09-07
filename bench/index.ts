// Re-exports only. The surface scripts/run-bench.ts is written against.
export { measureThroughput } from "./measure-throughput";
export type {
  ThroughputMeasurement,
  ThroughputOptions,
} from "./measure-throughput";
export {
  calibrateIterations,
  estimateRate,
  median,
  relativeSpreadPercent,
  takeRateSample,
  warmUp,
} from "./sample-rate";
export type { RateSample } from "./sample-rate";
export { measureThroughputRatio } from "./measure-throughput-ratio";
export type { MeasuredRatio } from "./measure-throughput-ratio";
export { rotateOverNothing, rotateOverValues } from "./rotate-over-values";
export type { ValuePool } from "./rotate-over-values";
export {
  RATIO_CASES,
  buildLuqSubject,
  buildReferenceSubject,
  describeRatioCase,
  poolForCase,
} from "./ratio-case";
export type { RatioCase } from "./ratio-case";
export { assertReferenceAgreesWithLuq } from "./assert-reference-agreement";
export {
  assertReferenceIsNotEliminated,
  measureReferenceWork,
} from "./measure-reference-work";
export type { ReferenceWork } from "./measure-reference-work";
export { GATE_SENSITIVITY } from "./gate-sensitivity";
export { measureBuildCost } from "./measure-build-cost";
export { measureLegacyComparison } from "./measure-legacy-throughput";
export { gateThroughputRatio } from "./gate-throughput-ratio";
export type { GateOutcome, GateReport } from "./gate-throughput-ratio";
export { recordPerfBaseline } from "./record-perf-baseline";
export type { RecordOptions } from "./record-perf-baseline";
export {
  CI_PERF_BASELINE_PATH,
  PERF_BASELINE_PATH,
  baselinePathForEnvironment,
  PerfBaselineUnreadableError,
  findRecordedFloor,
  readPerfBaseline,
} from "./read-perf-baseline";
export { describeMachine } from "./describe-machine";
export { BENCH_SHAPES, ARRAY_ELEMENT_COUNT } from "./shapes/index";
export type {
  BenchShape,
  BenchShapeName,
  BenchValidator,
} from "./shapes/bench-shape.types";
export { HAND_WRITTEN_CHECKS } from "./hand-written/index";
export type {
  BenchConditions,
  BuildCostRecord,
  GateSensitivityRecord,
  LegacyComparisonRecord,
  MachineDescription,
  PerfBaseline,
  ReferenceRatioRecord,
  ReferenceWorkRecord,
  ThroughputRecord,
} from "./perf-baseline.types";
