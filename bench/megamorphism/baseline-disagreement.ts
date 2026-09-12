// ===========================================================================
// bench/megamorphism/baseline-disagreement.ts — the measurement's own error
// floor, taken from inside the measurement.
//
// The two lanes' first points are THE SAME WINDOW: one validator over four
// values. `liveValidators` grows the validator count from there and
// `liveValues` grows the pool from there, so at a window size of one they are
// the same request, measured twice, in different processes, at different
// moments. Nothing about the code can make those two figures differ.
//
// So the gap between them is not a property of Luq. It is what this harness
// cannot resolve on the machine it ran on, measured rather than guessed, and
// a degradation smaller than it is not evidence of anything. Recording it is
// what stops a run on a busy machine from being read as a result: on the
// laptop this harness was written on, the two baselines disagreed by a quarter,
// which is more than twice the effect the harness was built to look for.
// ===========================================================================
import { roundTo } from "../round-to";
import type { Lane } from "./summarise-lane";

export interface MeasurementResolution {
  /** The gap between two measurements of the identical one-validator window. */
  readonly acceptedPercent: number;
  readonly rejectedPercent: number;
  /** The larger of the two: the figure a degradation has to beat to mean anything. */
  readonly worstPercent: number;
  readonly note: string;
}

const NOTE =
  "Both lanes start from the identical window — one validator over four values — so these two " +
  "figures are one request measured twice. Their gap is what this run could not resolve, and a " +
  "degradation smaller than worstPercent is not evidence of anything.";

function gapPercent(left: number, right: number): number {
  const larger = Math.max(left, right);
  if (larger === 0) return 0;
  return roundTo((Math.abs(left - right) / larger) * 100, 2);
}

export class ResolutionUnavailableError extends Error {}

export function measureResolution(
  lanes: readonly Lane[]
): MeasurementResolution {
  const first = lanes[0]?.points[0];
  const second = lanes[1]?.points[0];
  if (first === undefined || second === undefined) {
    throw new ResolutionUnavailableError(
      "the resolution of a run is the gap between two lanes' one-validator points, and fewer than two lanes were measured"
    );
  }
  if (
    first.validatorCount !== second.validatorCount ||
    first.poolSize !== second.poolSize
  ) {
    throw new ResolutionUnavailableError(
      `the lanes no longer start from the same window (${first.validatorCount}x${first.poolSize} against ` +
        `${second.validatorCount}x${second.poolSize}), so their gap is no longer the harness's own error`
    );
  }
  const acceptedPercent = gapPercent(
    first.acceptedOpsPerSecond,
    second.acceptedOpsPerSecond
  );
  const rejectedPercent = gapPercent(
    first.rejectedOpsPerSecond,
    second.rejectedOpsPerSecond
  );
  return {
    acceptedPercent,
    rejectedPercent,
    worstPercent: Math.max(acceptedPercent, rejectedPercent),
    note: NOTE,
  };
}
