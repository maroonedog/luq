// ===========================================================================
// bench/gate-sensitivity.ts — what the gate can and cannot see.
//
// A floor set at 75% of a recorded ratio cannot detect a regression smaller
// than a quarter, and there is no honest way to phrase that as "the gate
// catches regressions". So it is measured by MUTATION rather than reasoned
// about, and the answer is recorded into config/perf-baseline.json next to the
// floors, where anyone reading a green gate can see its resolution.
//
// Method, reproducible from this file: wrap each shape's built validator so
// that N iterations in every 20 run validate()/parse() a second time and
// compare the two outcomes (the comparison is what stops the optimiser
// deleting the extra call), then run every gated pairing against the recorded
// floors. N/20 is the slowdown. Measured on the recording machine, 15
// pairings, one run per level:
//
//     +0%    0/15 fail      +25%    3/15 fail
//   +100%   15/15 fail      +15%    0/15 fail
//    +60%   15/15 fail
//    +35%   14/15 fail
//
// So: a uniform 35% slowdown fails all but one pairing; 25% fails three, which
// is still a red build but only just; 15% is invisible. State that as "this
// gate sees a third and misses a sixth", not as "this gate catches
// regressions".
//
// For comparison, the gate this replaced — five pairings, validate on accepted
// input only — failed 2 of 5 at +35% and 5 of 5 at +60%, and one of its five
// floors was measured against a reference V8 had deleted.
// ===========================================================================
import type { GateSensitivityRecord } from "./perf-baseline.types";

export const GATE_SENSITIVITY: GateSensitivityRecord = Object.freeze({
  method:
    "each shape's validator wrapped so N of every 20 calls run twice and the two outcomes are compared; every gated pairing then measured against its recorded floor",
  caughtSlowdownPercent: 35,
  missedSlowdownPercent: 15,
  measuredAt: "2026-09-07 on the machine named in `machine`, one run per level",
  detail: Object.freeze([
    "+100% slower: 15/15 pairings below floor",
    "+60% slower: 15/15 below floor",
    "+35% slower: 14/15 below floor (jsonSchema validate/accepted passed at 0.1202 against a floor of 0.1194)",
    "+25% slower: 3/15 below floor — the build still goes red, but on three pairings out of fifteen",
    "+15% slower: 0/15 below floor. A regression this size does not move any number in this file.",
    "+0%: 0/15 below floor, so the levels above are the mutation and not the noise",
  ]),
});
