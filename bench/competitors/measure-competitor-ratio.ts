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
import { spawnSubject } from "./spawn-subject";
import type { SubjectPool, SubjectReport } from "./subject-report.types";

/** One pool, timed. */
export interface PoolRatio {
  readonly luqOpsPerSecond: number;
  readonly competitorOpsPerSecond: number;
  /** Above 1 means Luq is faster. */
  readonly ratio: number;
  readonly values: number;
  readonly luqSpreadPercent: number;
  readonly competitorSpreadPercent: number;
  /**
   * The harness's own per-call cost, measured in each child as the same pool
   * walk with nothing under it.
   *
   * Published rather than subtracted, because it is what tells a reader when a
   * ratio is being decided by the harness rather than by the libraries. On the
   * shapes where a competitor answers in tens of nanoseconds, a floor of ten is
   * a fifth of its call and a twentieth of Luq's — and a reader comparing two
   * numbers cannot see that unless it is printed.
   */
  readonly floorNanoseconds: number;
}

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
}

const LUQ = "luq";

/**
 * Spawns the two children for one pool, competitor first on alternate calls.
 *
 * Which goes first is alternated for the reason the old harness interleaved
 * samples: a machine that slows down for a second should not be able to charge
 * that second to the same subject every time.
 */
let competitorGoesFirst = false;

function timePool(
  shape: BenchShapeName,
  competitor: string,
  pool: SubjectPool
): PoolRatio | undefined {
  competitorGoesFirst = !competitorGoesFirst;
  const order: readonly string[] = competitorGoesFirst
    ? [competitor, LUQ]
    : [LUQ, competitor];

  const reports = new Map<string, SubjectReport>();
  for (const subject of order) {
    reports.set(subject, spawnSubject({ shape, subject, pool }));
  }

  const luq = reports.get(LUQ);
  const other = reports.get(competitor);
  if (luq === undefined || other === undefined) return undefined;
  if (luq.values < 2 || luq.opsPerSecond === 0 || other.opsPerSecond === 0) {
    return undefined;
  }

  // The mean of the two floors: they are the same walk over the same pool, so
  // a difference between them is the machine, not the harness.
  const floorOps = (luq.floorOpsPerSecond + other.floorOpsPerSecond) / 2;

  return {
    luqOpsPerSecond: luq.opsPerSecond,
    competitorOpsPerSecond: other.opsPerSecond,
    ratio: luq.opsPerSecond / other.opsPerSecond,
    values: luq.values,
    luqSpreadPercent: luq.spreadPercent,
    competitorSpreadPercent: other.spreadPercent,
    floorNanoseconds: floorOps > 0 ? 1e9 / floorOps : 0,
  };
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
  };
}
