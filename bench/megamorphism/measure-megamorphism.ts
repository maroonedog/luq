// ===========================================================================
// bench/megamorphism/measure-megamorphism.ts — the matrix, and why it has two
// lanes.
//
// THE QUESTION. Does a validate() call get slower when many DIFFERENT
// validators are alive and being called in turn? The mechanism it would come
// from is megamorphism: src/runtime/run-field.ts is one piece of code shared by
// every validator, and its `field.read(subject)` and `check.run(...)` sites see
// a different closure for every declared field of every live validator. Past a
// handful of targets V8 stops inlining them and dispatches indirectly.
//
// THE CONFOUNDER. Forty validators alive also means forty pools of values
// alive, and a bigger working set is slower for reasons that have nothing to do
// with call sites. So the matrix has two lanes, and they meet at one validator:
//
//   liveValidators   N validators, 4 values each.  N x 4 distinct values.
//   liveValues       1 validator, 4N values.       N x 4 distinct values.
//
// Both lanes touch the same number of distinct objects at the same window size.
// Only the first grows the number of call targets. Whatever `liveValues` shows
// is the price of the working set alone, and the difference between the lanes
// is what is left for megamorphism to explain.
//
// THE RUN'S OWN ERROR FLOOR. At a window size of one the two lanes are the same
// request, so their two first figures are one window measured twice. Their gap
// is recorded as `resolution` and is what any degradation here has to beat to
// mean anything — see baseline-disagreement.ts.
//
// WHAT IT DOES NOT ANSWER. The family holds work constant (see
// live-validator-family.ts), so this says nothing about a mix of validators of
// DIFFERENT sizes, and nothing about build() cost or memory.
// ===========================================================================
import { describeMachine } from "../describe-machine";
import { measureResolution } from "./baseline-disagreement";
import type { MeasurementResolution } from "./baseline-disagreement";
import { FAMILY_SIZE } from "./live-validator-family";
import { spawnLiveWindow } from "./spawn-live-window";
import { summariseLane } from "./summarise-lane";
import type { Lane } from "./summarise-lane";
import type { MachineDescription } from "../perf-baseline.types";
import type { WindowReport, WindowRequest } from "./window-report.types";

export const WINDOW_SIZES: readonly number[] = [1, 2, 5, 10, 20, 40];
export const BASE_POOL_SIZE = 4;
export const REPEAT_COUNT = 7;

/** Coprime with FAMILY_SIZE's factors, so repeats land on different members. */
const OFFSET_STRIDE = 7;

const LIVE_VALIDATORS = "liveValidators";
const LIVE_VALUES = "liveValues";

const LANE_QUESTIONS: Readonly<Record<string, string>> = {
  [LIVE_VALIDATORS]:
    "N different validators, 4 values each, called in turn: what an application with N live validators pays per call",
  [LIVE_VALUES]:
    "1 validator over 4N values: the same working set with only one set of call targets, so the lane above can be read net of it",
};

export interface MegamorphismMeasurement {
  readonly measuredAt: string;
  readonly machine: MachineDescription;
  readonly conditions: {
    readonly windowSizes: readonly number[];
    readonly repeatCount: number;
    readonly processPerWindow: string;
    readonly familySize: number;
    readonly declares: string;
    readonly moduleUnderTest: string;
  };
  /** What the run could not resolve, taken from inside the run. Read it first. */
  readonly resolution: MeasurementResolution;
  readonly lanes: readonly Lane[];
}

interface Job {
  readonly lane: string;
  readonly windowIndex: number;
  readonly request: WindowRequest;
}

function requestFor(lane: string, size: number, offset: number): WindowRequest {
  if (lane === LIVE_VALUES) {
    return { validatorCount: 1, poolSize: BASE_POOL_SIZE * size, offset };
  }
  return { validatorCount: size, poolSize: BASE_POOL_SIZE, offset };
}

/**
 * One repeat's worth of jobs. The order is REVERSED on every other repeat: a
 * machine that drifts during a repeat would otherwise always favour the small
 * windows, which are always measured first, and the drift would read as
 * degradation at the large ones.
 */
function jobsForRepeat(repeat: number): readonly Job[] {
  const offset = (repeat * OFFSET_STRIDE) % FAMILY_SIZE;
  const jobs: Job[] = [];
  for (const lane of [LIVE_VALIDATORS, LIVE_VALUES]) {
    WINDOW_SIZES.forEach((size, windowIndex) => {
      jobs.push({ lane, windowIndex, request: requestFor(lane, size, offset) });
    });
  }
  return repeat % 2 === 0 ? jobs : [...jobs].reverse();
}

function keyOf(lane: string, windowIndex: number): string {
  return `${lane}:${windowIndex}`;
}

function collect(
  repeatCount: number,
  onProgress: (line: string) => void
): ReadonlyMap<string, readonly WindowReport[]> {
  const collected = new Map<string, WindowReport[]>();
  for (let repeat = 0; repeat < repeatCount; repeat += 1) {
    for (const job of jobsForRepeat(repeat)) {
      const report = spawnLiveWindow(job.request);
      const key = keyOf(job.lane, job.windowIndex);
      const existing = collected.get(key) ?? [];
      existing.push(report);
      collected.set(key, existing);
      onProgress(
        `  repeat ${repeat + 1}/${repeatCount} ${job.lane.padEnd(14)} ` +
          `validators=${String(job.request.validatorCount).padStart(2)} ` +
          `pool=${String(job.request.poolSize).padStart(3)} ` +
          `accepted ${Math.round(report.accepted.opsPerSecond)} ops/sec, ` +
          `rejected ${Math.round(report.rejected.opsPerSecond)} ops/sec`
      );
    }
  }
  return collected;
}

function laneOf(
  collected: ReadonlyMap<string, readonly WindowReport[]>,
  lane: string
): Lane {
  return summariseLane(
    lane,
    LANE_QUESTIONS[lane] ?? "",
    WINDOW_SIZES.map((_size, windowIndex) => {
      const runs = collected.get(keyOf(lane, windowIndex));
      if (runs === undefined) {
        throw new Error(
          `no runs were collected for ${keyOf(lane, windowIndex)}`
        );
      }
      return runs;
    })
  );
}

export interface MegamorphismOptions {
  /** Child processes per window. Fewer than the default is an exploration. */
  readonly repeatCount?: number;
  readonly onProgress?: (line: string) => void;
}

export function measureMegamorphism(
  options: MegamorphismOptions = {}
): MegamorphismMeasurement {
  const repeatCount = options.repeatCount ?? REPEAT_COUNT;
  const collected = collect(
    repeatCount,
    options.onProgress ?? (() => undefined)
  );
  const lanes = [
    laneOf(collected, LIVE_VALIDATORS),
    laneOf(collected, LIVE_VALUES),
  ];
  return {
    measuredAt: new Date().toISOString(),
    machine: describeMachine(),
    conditions: {
      windowSizes: WINDOW_SIZES,
      repeatCount,
      processPerWindow:
        "every window is measured in its own child process: V8's inline caches are process-wide, so a one-validator figure taken after a forty-validator run is measured against caches the forty already spoiled",
      familySize: FAMILY_SIZE,
      declares:
        "every family member declares 3 fields with the same rule kinds (required/stringMin/stringMax/stringPattern/numberMin/numberMax) over values of the same lengths; only the names, the pattern and the bounds differ",
      moduleUnderTest:
        "src/ transpiled by ts-node (CommonJS, ES2020) — not the bundled dist",
    },
    resolution: measureResolution(lanes),
    lanes,
  };
}
