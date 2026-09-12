// ===========================================================================
// bench/megamorphism/summarise-lane.ts
//
// The arithmetic, with no measuring in it, so it can be tested against figures
// whose answer is known.
//
// A lane is one question asked at several window sizes. Each window was
// measured in several separate child processes, and the figure kept for it is
// the MEDIAN OF THE FASTEST HALF of those processes — the same estimator
// bench/measure-throughput.ts uses within a process, for the same reason.
// Interference is one-sided: a busy machine can only make a process slower, so
// the slow tail is about the machine and the fast half is about the code. The
// mean follows one unlucky process, and the single fastest will not reproduce.
//
// `degradationPercent` is stated relative to the lane's own first point, and
// positive means SLOWER. A negative number is not an error and must not be
// rounded away to zero: it means the larger window measured faster than the
// one-validator window, which is what "no effect, plus noise" looks like.
// ===========================================================================
import { estimateRate, relativeSpreadPercent } from "../sample-rate";
import { roundTo } from "../round-to";
import type { WindowReport } from "./window-report.types";

export interface LanePoint {
  readonly validatorCount: number;
  readonly poolSize: number;
  readonly distinctValues: number;
  readonly acceptedOpsPerSecond: number;
  readonly rejectedOpsPerSecond: number;
  /** Positive means slower than this lane's one-validator point. */
  readonly acceptedDegradationPercent: number;
  readonly rejectedDegradationPercent: number;
  /** How many child processes contributed, and how far apart they landed. */
  readonly runs: number;
  readonly acceptedRunSpreadPercent: number;
  readonly rejectedRunSpreadPercent: number;
  /** False when any contributing process reported a wide sample spread. */
  readonly everyRunQuiet: boolean;
}

export interface Lane {
  readonly name: string;
  /** What varying this lane's window size is meant to isolate. */
  readonly question: string;
  readonly points: readonly LanePoint[];
}

export class LaneSummaryError extends Error {}

function degradationPercent(baseline: number, measured: number): number {
  if (baseline === 0) return 0;
  return roundTo((1 - measured / baseline) * 100, 2);
}

function pointOf(
  runs: readonly WindowReport[],
  acceptedBaseline: number,
  rejectedBaseline: number
): LanePoint {
  const first = runs[0];
  if (first === undefined) {
    throw new LaneSummaryError("a lane point was summarised with no runs");
  }
  const acceptedRates = runs.map((run) => run.accepted.opsPerSecond);
  const rejectedRates = runs.map((run) => run.rejected.opsPerSecond);
  const accepted = estimateRate(acceptedRates);
  const rejected = estimateRate(rejectedRates);
  return {
    validatorCount: first.request.validatorCount,
    poolSize: first.request.poolSize,
    distinctValues: first.distinctValues,
    acceptedOpsPerSecond: Math.round(accepted),
    rejectedOpsPerSecond: Math.round(rejected),
    acceptedDegradationPercent: degradationPercent(acceptedBaseline, accepted),
    rejectedDegradationPercent: degradationPercent(rejectedBaseline, rejected),
    runs: runs.length,
    acceptedRunSpreadPercent: roundTo(
      relativeSpreadPercent(acceptedRates, accepted),
      2
    ),
    rejectedRunSpreadPercent: roundTo(
      relativeSpreadPercent(rejectedRates, rejected),
      2
    ),
    everyRunQuiet: runs.every(
      (run) => run.accepted.isQuiet && run.rejected.isQuiet
    ),
  };
}

/**
 * `runsByWindow` is in window order, smallest first, and the first entry is the
 * one every degradation figure is measured against. Ordering it any other way
 * would divide by a window that is not the one-validator case, which is the
 * only baseline the published sentence can mean.
 */
export function summariseLane(
  name: string,
  question: string,
  runsByWindow: readonly (readonly WindowReport[])[]
): Lane {
  const baselineRuns = runsByWindow[0];
  if (baselineRuns === undefined || baselineRuns.length === 0) {
    throw new LaneSummaryError(`lane ${name} has no one-validator baseline`);
  }
  const acceptedBaseline = estimateRate(
    baselineRuns.map((run) => run.accepted.opsPerSecond)
  );
  const rejectedBaseline = estimateRate(
    baselineRuns.map((run) => run.rejected.opsPerSecond)
  );
  return {
    name,
    question,
    points: runsByWindow.map((runs) =>
      pointOf(runs, acceptedBaseline, rejectedBaseline)
    ),
  };
}
