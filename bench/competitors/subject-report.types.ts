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

export interface SubjectRequest {
  readonly shape: string;
  /** `"luq"`, or a competitor's name as `COMPETITORS` spells it. */
  readonly subject: string;
  readonly pool: SubjectPool;
}

export interface SubjectReport {
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
