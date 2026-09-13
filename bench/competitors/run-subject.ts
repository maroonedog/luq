// ===========================================================================
// bench/competitors/run-subject.ts — the child. ONE subject, then exit.
//
// Run by spawn-subject.ts; not useful on its own.
//
// WHAT THIS FILE IS CAREFUL ABOUT, and the reason it exists as a separate
// process at all: the loop below must see exactly one `check` for the life of
// the process. Everything here is arranged around that.
//
//   - one subject is built, never two, so no second implementation is ever
//     reachable from the timed call site;
//   - the timed loop calls `check` directly rather than through a shared
//     rotation helper, because the helper's own call site is what went
//     polymorphic when a parent used it for both libraries;
//   - the pool is walked by an index in this file, so the walking is part of
//     the same monomorphic code as the call.
//
// The agreement pass is repeated here rather than passed in. Values cannot
// cross a process boundary without being serialised, and a Date or a RegExp
// in a shape's pool would not survive the trip as itself. Recomputing is a few
// hundred calls and is not timed.
// ===========================================================================
import { BENCH_SHAPES } from "../shapes/index";
import {
  estimateRate,
  relativeSpreadPercent,
  takeRateSample,
} from "../sample-rate";
import { calibrateIterations, warmUp } from "../sample-rate";
import { COMPETITORS } from "./index";
import { measureShapeAgreement } from "./measure-agreement";
import { parseSubjectArguments } from "./subject-arguments";
import {
  SAMPLE_COUNT,
  TARGET_SAMPLE_MS,
  WARMUP_MS,
  measureFloor,
  timedSubject,
} from "./timed-subject";
import type { SubjectReport, SubjectRequest } from "./subject-report.types";

/** The name the Luq side answers to. Not a competitor; there is no package. */
const LUQ = "luq";

class SubjectError extends Error {}

function shapeNamed(name: string) {
  const shape = BENCH_SHAPES.find((candidate) => candidate.name === name);
  if (shape === undefined) throw new SubjectError(`no shape "${name}"`);
  return shape;
}

/**
 * The values this child times, and what each of them is expected to answer.
 *
 * Only values both sides agreed on are timed, which is the same rule the
 * one-process harness followed: timing a disagreement reports "the other
 * library did different work" as a difference in speed.
 */
function poolFor(request: SubjectRequest): {
  readonly values: readonly unknown[];
  readonly expected: ReadonlyMap<unknown, boolean>;
} {
  const shape = shapeNamed(request.shape);
  const competitorName = request.subject === LUQ ? undefined : request.subject;
  const competitor = COMPETITORS.find(
    (candidate) => candidate.name === (competitorName ?? candidate.name)
  );
  if (competitor === undefined) {
    throw new SubjectError(`no competitor "${request.subject}"`);
  }
  const agreement = measureShapeAgreement(shape, competitor);
  if (agreement === undefined) {
    throw new SubjectError(
      `${request.shape}: ${competitor.name} has no subject`
    );
  }
  const values =
    request.pool === "accepted"
      ? agreement.acceptedAgreed
      : request.pool === "rejected"
        ? agreement.rejectedAgreed
        : agreement.agreedValues;

  const judge = shape.buildValidator();
  const expected = new Map<unknown, boolean>();
  for (const value of values) expected.set(value, judge.validate(value).valid);
  return { values, expected };
}

/**
 * The one function the timed loop calls. Built once, from one library.
 *
 * The pool walk is INSIDE it, so there is exactly one closure between the
 * sampler and the library. A separate walker calling a separate checker put
 * two frames there, and two frames cost the same nanoseconds to each side of a
 * ratio — which is worth proportionally more to whichever side is faster.
 * Against this repository's `singleField` shape that is the difference between
 * reporting zod at 17.8M ops/sec and at 21M.
 *
 * The Luq validator is built here rather than handed in for the same reason
 * the agreement is recomputed: a built validator cannot cross a process
 * boundary.
 */
function checkerFor(request: SubjectRequest): (value: unknown) => boolean {
  const shape = shapeNamed(request.shape);
  if (request.subject === LUQ) {
    const validator = shape.buildValidator();
    return (value) => validator.validate(value).valid;
  }
  const competitor = COMPETITORS.find(
    (candidate) => candidate.name === request.subject
  );
  const subject = competitor?.subjects[shape.name];
  if (subject === undefined) {
    throw new SubjectError(`${request.shape}: no ${request.subject} subject`);
  }
  return (value) => subject.check(value);
}

function run(): void {
  const request = parseSubjectArguments(process.argv.slice(2));
  const { values, expected } = poolFor(request);

  if (values.length < 2) {
    // Below two values the engine constant-folds the single value away on one
    // side and not the other. The parent decides what to do about it; this
    // child refuses to report a rate it does not believe.
    const empty: SubjectReport = {
      opsPerSecond: 0,
      floorOpsPerSecond: 0,
      values: values.length,
      spreadPercent: 0,
      verdictsHeld: true,
    };
    process.stdout.write(`${JSON.stringify(empty)}\n`);
    return;
  }

  const check = checkerFor(request);

  // Checked ONCE, before anything is timed, and never inside the loop.
  //
  // Asserting it per call meant a Map lookup on every timed iteration, and a
  // fixed per-call cost is the exact defect this file exists to remove: at
  // roughly 15 ns it is 30% of a zod call on this shape and 8% of a Luq one,
  // so it would flatter Luq by the same mechanism, one layer down. The pool is
  // finite and the subjects are pure, so one pass answers the question the
  // in-loop assertion was asking.
  const held = values.every((value) => check(value) === expected.get(value));

  const subject = timedSubject(values, check);

  warmUp(subject, WARMUP_MS);
  const iterations = calibrateIterations(subject, TARGET_SAMPLE_MS);
  const rates: number[] = [];
  for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
    rates.push(takeRateSample(subject, iterations).opsPerSecond);
  }

  const rate = estimateRate(rates);
  const report: SubjectReport = {
    opsPerSecond: rate,
    floorOpsPerSecond: measureFloor(values),
    values: values.length,
    spreadPercent: relativeSpreadPercent(rates, rate),
    verdictsHeld: held,
  };
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

run();
