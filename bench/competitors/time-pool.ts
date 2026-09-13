// ===========================================================================
// bench/competitors/time-pool.ts
//
// Spawning the two children for one comparison, and the shapes their rates
// come back as.
//
// Separate from measure-competitor-ratio.ts so that file states WHAT is
// compared and this one states HOW it is spawned. They were one file until the
// code-generation dimension doubled the number of spawns.
// ===========================================================================
import type { BenchShapeName } from "../shapes/bench-shape.types";
import { spawnSubject } from "./spawn-subject";
import type {
  CodeGeneration,
  SubjectPool,
  SubjectReport,
} from "./subject-report.types";

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

/** What a competitor does when `new Function` throws. */
export interface BlockedCodeGeneration {
  /** Absent when the library could not be built at all. */
  readonly competitorOpsPerSecond: number | undefined;
  readonly ratio: number | undefined;
  /** Why there is no rate, when there is none. */
  readonly unavailable: string | undefined;
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

export function timePool(
  shape: BenchShapeName,
  competitor: string,
  pool: SubjectPool,
  codeGeneration: CodeGeneration = "allowed"
): PoolRatio | undefined {
  competitorGoesFirst = !competitorGoesFirst;
  const order: readonly string[] = competitorGoesFirst
    ? [competitor, LUQ]
    : [LUQ, competitor];

  const reports = new Map<string, SubjectReport>();
  for (const subject of order) {
    reports.set(
      subject,
      spawnSubject({
        shape,
        subject,
        against: competitor,
        pool,
        codeGeneration,
      })
    );
  }

  const luq = reports.get(LUQ);
  const other = reports.get(competitor);
  if (luq === undefined || other === undefined) return undefined;
  if (luq.unavailable !== undefined || other.unavailable !== undefined) {
    return undefined;
  }
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

/**
 * The competitor again, with run-time code generation forbidden.
 *
 * Taken on the ACCEPTED pool only. The question a strict CSP raises is what an
 * application pays for the input it expects, and measuring the refusal path
 * under the flag as well would double a five-minute job to answer a question
 * nobody asked.
 *
 * Luq is re-measured under the flag rather than reused from the allowed run,
 * because the claim that it does not move is the one thing here worth
 * checking rather than assuming.
 */
export function measureBlocked(
  shape: BenchShapeName,
  competitor: string
): BlockedCodeGeneration | undefined {
  const other = spawnSubject({
    shape,
    subject: competitor,
    against: competitor,
    pool: "accepted",
    codeGeneration: "blocked",
  });
  if (other.unavailable !== undefined) {
    return {
      competitorOpsPerSecond: undefined,
      ratio: undefined,
      unavailable: other.unavailable,
    };
  }
  const luq = spawnSubject({
    shape,
    subject: LUQ,
    against: competitor,
    pool: "accepted",
    codeGeneration: "blocked",
  });
  if (luq.unavailable !== undefined || other.opsPerSecond === 0) {
    return undefined;
  }
  return {
    competitorOpsPerSecond: other.opsPerSecond,
    ratio: luq.opsPerSecond / other.opsPerSecond,
    unavailable: undefined,
  };
}
