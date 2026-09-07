// ===========================================================================
// bench/record-absolute-figures.ts
//
// The two sections of config/perf-baseline.json that nothing gates on:
// throughput (ops/sec for validate and parse) and build cost (what one build()
// costs in validate() calls). They are recorded because prose has to quote a
// number from somewhere and the alternative is retyping one — the mistake 1.x
// made and published for a year — not because CI can act on them. A shared
// runner's absolute throughput is not a property of this repository, which is
// why the gate lives in record-ratio-figures.ts instead.
//
// Both measurements rotate over the shape's accepted pool, the same way the
// gate does, so a figure here and a figure there were produced by the same
// subject and can be compared.
// ===========================================================================
import { measureThroughput } from "./measure-throughput";
import { measureBuildCost } from "./measure-build-cost";
import { rotateOverValues } from "./rotate-over-values";
import { roundTo } from "./round-to";
import { BENCH_SHAPES } from "./shapes/index";
import type { BuildCostRecord, ThroughputRecord } from "./perf-baseline.types";

export function measureThroughputRecords(): readonly ThroughputRecord[] {
  const records: ThroughputRecord[] = [];
  for (const shape of BENCH_SHAPES) {
    const validator = shape.buildValidator();
    const validated = measureThroughput(
      `${shape.name}:validate`,
      rotateOverValues(
        shape.acceptedValues,
        (value) => validator.validate(value).valid
      )
    );
    const parsed = measureThroughput(
      `${shape.name}:parse`,
      rotateOverValues(
        shape.acceptedValues,
        (value) => validator.parse(value).valid
      )
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

export function measureBuildCostRecords(): readonly BuildCostRecord[] {
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
