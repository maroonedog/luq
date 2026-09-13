// ===========================================================================
// bench/competitors/unavailable-report.ts
//
// What a child says when the library it was asked to measure could not be
// built at all.
//
// ajv under blocked code generation is the case: it does not run slower, it
// throws EvalError out of `compile()` and there is no validator. That is the
// most interesting single result this comparison produces, and a crash would
// have thrown it away.
// ===========================================================================
import type { SubjectReport } from "./subject-report.types";

/**
 * The report a subject that could not be built at all comes back as.
 *
 * ajv under blocked code generation is the case this exists for: it does not
 * run slower, it throws EvalError out of `compile()` and there is no validator.
 * Reported rather than crashed, because "cannot run here" is the most
 * interesting thing this comparison can find, and a crash would throw it away.
 */
export function unavailableReport(reason: string): SubjectReport {
  return {
    unavailable: reason,
    opsPerSecond: 0,
    floorOpsPerSecond: 0,
    values: 0,
    spreadPercent: 0,
    verdictsHeld: true,
  };
}

export function describeFailure(thrown: unknown): string {
  if (thrown instanceof Error) {
    return `${thrown.name}: ${thrown.message.split("\n")[0] ?? ""}`;
  }
  return String(thrown);
}
