// ===========================================================================
// bench/megamorphism/measure-live-window.ts
//
// One window, measured in the process that is about to exit. Builds the family
// members, proves every pool still gets the verdict it promises, then times the
// accepted pool and the rejected pool SEPARATELY.
//
// Separately, because config/perf-baseline.json already carries the reason on
// every row it records: a pool that mixes accepted and rejected values measures
// error construction as much as validation, and the mixture it happens to hold
// then decides the figure. Under `abortEarly` the rejected path is a different
// program — early exit, issue construction, a rendered message — so the two
// paths could answer this directory's question differently, and a single
// blended number would hide it.
//
// Sampling follows bench/measure-throughput.ts: median of the fastest half of
// nine samples, re-measured while the spread stays wide, and `isQuiet` false
// when it never narrowed. Interference is one-sided, so the fast half is the
// signal and the slow tail is the machine.
// ===========================================================================
import { measureThroughput } from "../measure-throughput";
import { describeMachine } from "../describe-machine";
import { buildLiveFamily } from "./live-validator-family";
import {
  assertPoolVerdicts,
  rotateOverLiveValidators,
} from "./rotate-over-live-validators";
import type {
  PoolFigure,
  WindowReport,
  WindowRequest,
} from "./window-report.types";

const TARGET_SAMPLE_MS = 40;
const SAMPLE_COUNT = 15;
const WARMUP_MS = 200;
const ATTEMPTS = 4;
const MAX_SPREAD_PERCENT = 20;

function timePool(label: string, subject: () => boolean): PoolFigure {
  const measured = measureThroughput(label, subject, {
    targetSampleMs: TARGET_SAMPLE_MS,
    sampleCount: SAMPLE_COUNT,
    warmupMs: WARMUP_MS,
    attempts: ATTEMPTS,
    maxSpreadPercent: MAX_SPREAD_PERCENT,
  });
  return {
    opsPerSecond: measured.opsPerSecond,
    relativeSpreadPercent: measured.relativeSpreadPercent,
    isQuiet: measured.isQuiet,
    agreedCalls: measured.acceptedCount,
    totalCalls: measured.iterationsPerSample * measured.sampleCount,
  };
}

export class LiveWindowDisagreementError extends Error {}

/**
 * The sampler counts the calls that returned true, and the subject returns
 * "the verdict was the promised one". So a count short of the call count means
 * a validator changed its mind partway through a timed run, and the figure
 * describes something other than what the label says.
 */
function assertEveryCallAgreed(label: string, figure: PoolFigure): void {
  if (figure.agreedCalls !== figure.totalCalls) {
    throw new LiveWindowDisagreementError(
      `${label}: ${figure.totalCalls - figure.agreedCalls} of ${figure.totalCalls} ` +
        "timed calls did not give the verdict their pool promised"
    );
  }
}

export function measureLiveWindow(request: WindowRequest): WindowReport {
  const shapes = buildLiveFamily(
    request.validatorCount,
    request.offset,
    request.poolSize
  );
  assertPoolVerdicts(shapes);

  const accepted = timePool(
    `accepted/${request.validatorCount}`,
    rotateOverLiveValidators(shapes, true)
  );
  const rejected = timePool(
    `rejected/${request.validatorCount}`,
    rotateOverLiveValidators(shapes, false)
  );
  assertEveryCallAgreed(`accepted/${request.validatorCount}`, accepted);
  assertEveryCallAgreed(`rejected/${request.validatorCount}`, rejected);

  return {
    request,
    distinctValues: request.validatorCount * request.poolSize,
    members: shapes.map((shape) => shape.label),
    accepted,
    rejected,
    machine: describeMachine(),
  };
}
