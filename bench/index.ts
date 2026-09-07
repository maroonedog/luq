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
export { measureBuildCost } from "./measure-build-cost";
export { measureLegacyComparison } from "./measure-legacy-throughput";
export { gateThroughputRatio } from "./gate-throughput-ratio";
export type { GateOutcome, GateReport } from "./gate-throughput-ratio";
export { recordPerfBaseline } from "./record-perf-baseline";
export type { RecordOptions } from "./record-perf-baseline";
export {
  PERF_BASELINE_PATH,
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
  LegacyComparisonRecord,
  MachineDescription,
  PerfBaseline,
  ReferenceRatioRecord,
  ThroughputRecord,
} from "./perf-baseline.types";
