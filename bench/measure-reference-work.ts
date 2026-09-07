// ===========================================================================
// bench/measure-reference-work.ts — the canary that would have caught it.
//
// The agreement check proves the reference computes the right answer. It does
// NOT prove the reference runs: a call the optimiser has folded away still
// produces the right answer, instantly, forever. That is what happened to the
// singleField reference, and the ratio gate spent its whole life dividing
// Luq's throughput by this harness's own empty-loop speed with nothing in the
// harness able to notice.
//
// So the reference is timed against the FLOOR: the identical rotation over the
// identical pool with the check replaced by `() => true`. A reference that is
// not measurably slower than doing nothing is not being executed. The two are
// INTERLEAVED, for the reason in take-interleaved-samples.ts — it is a ratio,
// and a ratio taken across two separated halves belongs to the machine.
//
// Measured on the recording machine, reference / floor, on singleField —
// the thinnest reference there is and therefore the hardest case:
//   the OLD subject, `() => check(oneFrozenValue)` against `() => true`,
//     three runs in one process: 1.002, 0.641, 0.635
//   the NEW subject, rotating over a four-value pool against the identical
//     rotation doing nothing, three runs: 0.758, 0.659, 0.657
// Two things follow. The elimination is INTERMITTENT — the first of those old
// runs had it and the next two did not, which is V8 deciding, not the code
// changing — so a structural fix was needed and a canary alone would not have
// been enough. And the two populations do not overlap, which is what the
// threshold lives in. 0.95 is where it sits: an eliminated reference IS the
// floor, so it reads 1.00 or above by construction, while the healthy
// singleField figure reached 0.843 during a recording run with the machine
// under load. The other four shapes are nowhere near the line — multiField
// 0.13, nested 0.28, array and jsonSchema 0.01 — so singleField is the only
// shape whose margin is worth arguing about.
//
// A second discriminator was tried and REJECTED: calling the reference twice
// per iteration and requiring the subject to get slower. It works when the
// subject calls the reference directly, but once both subjects go through the
// pool rotation the doubling changes how V8 inlines them, and three
// consecutive runs of the singleField shape reported 1.068, 0.786 and 0.788 —
// the first of them claiming two calls are FASTER than one. A canary that
// fires at random is worse than none, so the floor comparison stands alone.
// ===========================================================================
import { estimateRate, median } from "./sample-rate";
import { takeInterleavedSamples } from "./take-interleaved-samples";
import { rotateOverNothing } from "./rotate-over-values";
import {
  buildReferenceSubject,
  poolForCase,
  type RatioCase,
} from "./ratio-case";
import { HAND_WRITTEN_CHECKS } from "./hand-written/index";
import type { BenchShape, BenchShapeName } from "./shapes/bench-shape.types";

const NANOSECONDS_PER_SECOND = 1e9;

/**
 * Seven samples rather than the default nine, because two subjects this cheap
 * calibrate to enormous iteration counts and the canary runs before every
 * gated pairing. Three samples was tried and is NOT enough: it reported the
 * singleField ratio as 1.11 on one run and 0.75 on the next.
 */
const CANARY_OPTIONS = {
  targetSampleMs: 100,
  sampleCount: 7,
  warmupMs: 200,
};

/** See the file comment for the two measured populations this separates. */
const MAX_REFERENCE_SHARE_OF_FLOOR = 0.95;

export interface ReferenceWork {
  readonly shape: BenchShapeName;
  readonly inputIsAccepted: boolean;
  /** The identical rotation with the check replaced by `() => true`. */
  readonly harnessFloorOpsPerSecond: number;
  readonly referenceOpsPerSecond: number;
  /** Median of the per-pair reference/floor ratios. What is asserted on. */
  readonly shareOfFloor: number;
  /** Reference cost minus the rotation's own cost. Must be positive. */
  readonly netNanosecondsPerCall: number;
}

/**
 * Keyed by shape and pool, not by operation: the reference is the same
 * function and the pool the same pool whether the Luq side of the pairing
 * calls validate() or parse(), so a second measurement would measure the same
 * thing and cost another second of every gate run.
 */
const measured = new Map<string, ReferenceWork>();

function measureOnce(shape: BenchShape, ratioCase: RatioCase): ReferenceWork {
  const reference = HAND_WRITTEN_CHECKS[shape.name];
  const pool = poolForCase(shape, ratioCase);

  const samples = takeInterleavedSamples(
    buildReferenceSubject(reference, shape, ratioCase),
    rotateOverNothing(pool),
    CANARY_OPTIONS
  );
  const referenceOps = estimateRate(samples.firstRates);
  const floorOps = estimateRate(samples.secondRates);

  return {
    shape: shape.name,
    inputIsAccepted: ratioCase.inputIsAccepted,
    harnessFloorOpsPerSecond: floorOps,
    referenceOpsPerSecond: referenceOps,
    shareOfFloor: median(samples.pairRatios),
    netNanosecondsPerCall:
      NANOSECONDS_PER_SECOND / referenceOps - NANOSECONDS_PER_SECOND / floorOps,
  };
}

export function measureReferenceWork(
  shape: BenchShape,
  ratioCase: RatioCase
): ReferenceWork {
  const key = `${shape.name}:${String(ratioCase.inputIsAccepted)}`;
  const remembered = measured.get(key);
  if (remembered !== undefined) return remembered;
  const work = measureOnce(shape, ratioCase);
  measured.set(key, work);
  return work;
}

export function assertReferenceIsNotEliminated(work: ReferenceWork): void {
  if (work.shareOfFloor <= MAX_REFERENCE_SHARE_OF_FLOOR) return;
  throw new Error(
    `${work.shape} (${work.inputIsAccepted ? "accepted" : "rejected"} pool): the hand-written reference runs at ${Math.round(work.referenceOpsPerSecond)} ops/sec against an EMPTY rotation over the same pool at ${Math.round(work.harnessFloorOpsPerSecond)} — ${work.shareOfFloor.toFixed(3)} of it, where anything above ${MAX_REFERENCE_SHARE_OF_FLOOR} means the call is not happening. The ratio would divide Luq by this harness's loop speed. See bench/rotate-over-values.ts.`
  );
}
