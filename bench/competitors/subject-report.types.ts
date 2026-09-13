// ===========================================================================
// bench/competitors/subject-report.types.ts
//
// What one child process measures, and the shape it prints back.
//
// ONE subject per child, and that is the whole reason these files exist.
// Timing Luq and a competitor in one process put both of them through the same
// call site inside `rotateOverValues` — `consume(value)` — which then saw two
// different functions and went polymorphic. The cost of that lands as a fixed
// number of nanoseconds per call, so it is charged to both libraries equally
// and HURTS THE FASTER ONE MORE: measured directly, zod answered this
// repository's `singleField` shape at 28.1M ops/sec; through a rotation whose
// call site had seen a second consume, 21.2M. Luq, at roughly a fifth of that
// rate, did not move.
//
// A ratio taken that way is not a comparison of two engines. It is a
// comparison of two engines plus a constant, and the constant is worth more to
// whichever engine is slower.
//
// bench/megamorphism/ was built to measure exactly this effect and takes
// exactly this precaution, one child per window, for exactly this reason. The
// precaution did not travel back here until the ratio it produced was checked
// against a direct loop.
// ===========================================================================

/** Which pool a child was asked to time. */
export type SubjectPool = "mixed" | "accepted" | "rejected";

/**
 * Whether the child may build code at run time.
 *
 * `blocked` starts the child with --disallow-code-generation-from-strings, so
 * `new Function` and `eval` throw. That is what a strict Content-Security-
 * Policy does to a page, and it is not a detail: zod 4 compiles a per-shape
 * function through `new Function` when it can, probes for permission with a
 * `try { new Function("") }`, and falls back to interpretation when the probe
 * fails. ajv does not fall back — `compile()` throws EvalError and there is no
 * validator at all.
 *
 * Measured as one number, "zod" therefore names two different programs
 * depending on where it runs. Both are recorded, and neither is the headline.
 */
export type CodeGeneration = "allowed" | "blocked";

export interface SubjectRequest {
  readonly shape: string;
  /** `"luq"`, or a competitor's name as `COMPETITORS` spells it. */
  readonly subject: string;
  /**
   * The competitor whose agreement defines the pool.
   *
   * Equal to `subject` for a competitor. For the Luq side it names the
   * competitor Luq is being compared against, and it is REQUIRED rather than
   * optional: only the values both sides answered the same way are timed, so
   * the two children of one comparison must walk the same pool. The
   * one-process harness passed no such thing and resolved the Luq side against
   * whichever competitor came first in the list, which meant Luq's rate for
   * every pair was measured over zod's agreed values.
   */
  readonly against: string;
  readonly pool: SubjectPool;
  readonly codeGeneration: CodeGeneration;
}

export interface SubjectReport {
  /**
   * What stopped the subject from being measured at all, or undefined when it
   * ran.
   *
   * Recorded rather than thrown, because "this library cannot run here" is the
   * most interesting answer the comparison produces and a crash would discard
   * it. ajv under blocked code generation is the case: it does not degrade, it
   * fails to build.
   */
  readonly unavailable?: string;
  readonly opsPerSecond: number;
  /**
   * The same walk with nothing under it, measured in the same process.
   *
   * Reported so a reader can see when a ratio is being decided by the harness
   * rather than by the libraries. Never subtracted: subtraction would push this
   * figure's own error into every ratio.
   */
  readonly floorOpsPerSecond: number;
  /** How many values the pool held. Below two, the caller does not time it. */
  readonly values: number;
  readonly spreadPercent: number;
  /**
   * Every timed call answered as the agreement pass said it would.
   *
   * A subject that starts answering differently partway through has broken the
   * premise of the comparison, and a rate measured across that change means
   * nothing. The child asserts it rather than the parent, because only the
   * child ever sees the individual verdicts.
   */
  readonly verdictsHeld: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isSubjectReport(value: unknown): value is SubjectReport {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return (
    isFiniteNumber(record["opsPerSecond"]) &&
    isFiniteNumber(record["floorOpsPerSecond"]) &&
    isFiniteNumber(record["values"]) &&
    isFiniteNumber(record["spreadPercent"]) &&
    typeof record["verdictsHeld"] === "boolean"
  );
}
