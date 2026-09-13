// ===========================================================================
// bench/competitors/measure-competitor-ratio.ts
//
// One shape against one competitor. Each side is measured in its OWN child
// process, and the ratio is taken between the two rates afterwards.
//
// It used to time them alternately in one process, which was wrong in a way
// that only showed when the result was checked against a plain loop. Both
// sides went through the same `consume(value)` call site inside
// `rotateOverValues`; that site then saw two different functions and stopped
// being monomorphic. The cost is a fixed number of nanoseconds per call, and a
// fixed cost is worth proportionally more to whichever library is faster:
// measured directly, zod answered `singleField` at 28.1M ops/sec, and through
// a rotation that had seen a second consume, 21.2M. Luq, five times slower per
// call, did not move. The published ratio was flattering Luq by roughly three
// times, and the further ahead a competitor was, the more it flattered.
//
// Alternating them was meant to stop machine drift landing on one side. That
// reason was real, and it is now served differently: the children are spawned
// alternately, so a slow patch on the machine still straddles both subjects.
//
// **Only values whose verdicts agreed are timed.** Disagreements are counted
// elsewhere; timing them would report "the other library did different work"
// as a difference in speed.
//
// Only the validate-equivalent round trip is timed, never parse. Most
// competitors do not separate validating from converting, and forcing a
// correspondence makes the comparison the arbitrary part.
// ===========================================================================
import type { BenchShape, BenchShapeName } from "../shapes/bench-shape.types";
import type { Competitor } from "./competitor.types";
import { measureShapeAgreement } from "./measure-agreement";
import { measureBlocked, timePool } from "./time-pool";

export type { BlockedCodeGeneration, PoolRatio } from "./time-pool";
import type { BlockedCodeGeneration, PoolRatio } from "./time-pool";

export interface CompetitorRatio {
  readonly shape: BenchShapeName;
  readonly competitor: string;
  readonly competitorVersion: string;
  readonly luqOpsPerSecond: number;
  readonly competitorOpsPerSecond: number;
  /** Above 1 means Luq is faster. */
  readonly ratio: number;
  /** How many values were timed, and how many were excluded as disagreements. */
  readonly comparedValues: number;
  readonly disagreedValues: number;
  readonly luqSpreadPercent: number;
  readonly competitorSpreadPercent: number;
  /**
   * The same measurement over the accepted values alone and the rejected ones
   * alone.
   *
   * The mixed figure above is what this file used to report on its own. A
   * library that constructs a rich error on every refusal does most of its work
   * in `rejected`, so a pool that is half refusals measures error construction
   * as much as validation — and published as one number, that reads as a
   * validation result.
   *
   * `undefined` when a pool held fewer than two values: the engine
   * constant-folds a single value away on one side and not the other.
   */
  readonly accepted: PoolRatio | undefined;
  readonly rejected: PoolRatio | undefined;
  /**
   * The competitor with run-time code generation forbidden, or undefined when
   * it is the same program either way.
   *
   * A strict Content-Security-Policy is not a footnote to these figures, it is
   * a different comparison. zod 4 compiles a per-shape function through
   * `new Function` when it is allowed to and interprets when it is not, so one
   * number named "zod" is two programs. ajv does not degrade at all — it throws
   * out of `compile()` and there is no validator, which is recorded here as an
   * absent rate with the reason.
   *
   * Luq is measured under the same flag and does not move: it generates no
   * code, and `npm run check:no-dynamic-code` is what keeps that true.
   */
  readonly blockedCodeGeneration: BlockedCodeGeneration | undefined;
}

export function measureCompetitorRatio(
  shape: BenchShape,
  competitor: Competitor
): CompetitorRatio | undefined {
  const subject = competitor.subjects[shape.name];
  const agreement = measureShapeAgreement(shape, competitor);
  if (subject === undefined || agreement === undefined) return undefined;
  if (agreement.agreedValues.length === 0) return undefined;

  const mixed = timePool(shape.name, competitor.name, "mixed");
  if (mixed === undefined) return undefined;

  return {
    shape: shape.name,
    competitor: competitor.name,
    competitorVersion: competitor.version,
    luqOpsPerSecond: mixed.luqOpsPerSecond,
    competitorOpsPerSecond: mixed.competitorOpsPerSecond,
    ratio: mixed.ratio,
    comparedValues: agreement.agreedValues.length,
    disagreedValues: agreement.disagreements.length,
    luqSpreadPercent: mixed.luqSpreadPercent,
    competitorSpreadPercent: mixed.competitorSpreadPercent,
    accepted: timePool(shape.name, competitor.name, "accepted"),
    rejected: timePool(shape.name, competitor.name, "rejected"),
    blockedCodeGeneration: measureBlocked(shape.name, competitor.name),
  };
}
