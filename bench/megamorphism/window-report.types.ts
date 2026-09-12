// ===========================================================================
// bench/megamorphism/window-report.types.ts
//
// The contract between the parent that orders measurements and the CHILD
// PROCESS that takes them, plus the predicate that reads a child's answer back
// without a type assertion.
//
// A child process per window is not caution, it is the only way this
// measurement can be taken at all. V8's inline caches live in the feedback
// vectors of the running code, and src/runtime/run-field.ts is ONE piece of
// code shared by every validator in the process. Once a run with forty
// validators alive has driven those call sites megamorphic, they stay
// megamorphic: a "one validator alive" figure taken afterwards, in the same
// process, is measured against caches the forty already spoiled. Measuring
// both in one process can therefore only ever understate the effect, and would
// report "no degradation" whether or not there is any.
// ===========================================================================
import type { MachineDescription } from "../perf-baseline.types";

export interface WindowRequest {
  /** How many DIFFERENT validators are alive and being called in turn. */
  readonly validatorCount: number;
  /** How many distinct values each of them rotates over. At least 2. */
  readonly poolSize: number;
  /** Where in the family the window starts, so the baseline is not one member. */
  readonly offset: number;
}

/** One pool of one window, timed. Accepted and rejected are never mixed. */
export interface PoolFigure {
  readonly opsPerSecond: number;
  readonly relativeSpreadPercent: number;
  readonly isQuiet: boolean;
  /** Calls that gave the verdict the pool promised. Equal to the call count. */
  readonly agreedCalls: number;
  readonly totalCalls: number;
}

export interface WindowReport {
  readonly request: WindowRequest;
  /** validatorCount x poolSize: the distinct objects the run touches. */
  readonly distinctValues: number;
  readonly members: readonly string[];
  readonly accepted: PoolFigure;
  readonly rejected: PoolFigure;
  readonly machine: MachineDescription;
}

function isPoolFigure(value: unknown): value is PoolFigure {
  if (typeof value !== "object" || value === null) return false;
  const figure: Record<string, unknown> = { ...value };
  return (
    typeof figure["opsPerSecond"] === "number" &&
    typeof figure["relativeSpreadPercent"] === "number" &&
    typeof figure["isQuiet"] === "boolean" &&
    typeof figure["agreedCalls"] === "number" &&
    typeof figure["totalCalls"] === "number"
  );
}

function isWindowRequest(value: unknown): value is WindowRequest {
  if (typeof value !== "object" || value === null) return false;
  const request: Record<string, unknown> = { ...value };
  return (
    typeof request["validatorCount"] === "number" &&
    typeof request["poolSize"] === "number" &&
    typeof request["offset"] === "number"
  );
}

/**
 * A child that died halfway, or printed a warning where the report was
 * expected, must not be read as a measurement of zero. The parent turns a
 * false answer here into a failure that names the window.
 */
export function isWindowReport(value: unknown): value is WindowReport {
  if (typeof value !== "object" || value === null) return false;
  const report: Record<string, unknown> = { ...value };
  return (
    isWindowRequest(report["request"]) &&
    typeof report["distinctValues"] === "number" &&
    Array.isArray(report["members"]) &&
    isPoolFigure(report["accepted"]) &&
    isPoolFigure(report["rejected"]) &&
    typeof report["machine"] === "object" &&
    report["machine"] !== null
  );
}
