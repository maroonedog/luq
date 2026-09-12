// ===========================================================================
// bench/competitors/measure-agreement.ts
//
// Before measuring speed, count **whether they give the same answer**.
//
// Against the hand-written reference this is an assertion and a disagreement
// fails the build. Against a competitor it must not: how strict a library's
// `email` rule is differs between libraries, which is a difference in
// specification rather than in quality, and not ours to fix.
//
// So it is counted and reported instead. Only values everyone agreed on are
// timed, and the disagreements are kept, both the count and the values:
//   * timing only agreed values -> the comparison is over the same work
//   * reporting disagreements   -> "faster, but judging differently" is visible
//
// Doing one without the other loses the honesty of it. Time everything and a
// competitor that is fast because it does less goes unnoticed; hide the
// disagreements and the counts can no longer be explained.
// ===========================================================================
import { BENCH_SHAPES } from "../shapes/index";
import type { BenchShape, BenchShapeName } from "../shapes/bench-shape.types";
import type { Competitor } from "./competitor.types";

export interface Disagreement {
  readonly value: unknown;
  /** What Luq answered. The competitor answered the opposite. */
  readonly luqSaid: boolean;
}

export interface ShapeAgreement {
  readonly shape: BenchShapeName;
  readonly competitor: string;
  readonly agreedValues: readonly unknown[];
  /**
   * The same values, split by which answer they get.
   *
   * They used to be reported only as one pool, and the ratio was measured over
   * it — four accepted values and four rejected ones, timed together and
   * published as a single figure. That hides the thing most likely to move it:
   * a library can be fast to accept and slow to refuse, and the pool's
   * composition then decides the headline. config/perf-baseline.json already
   * carries `inputIsAccepted` on every Luq row for exactly this reason; the
   * competitor rows had no equivalent.
   */
  readonly acceptedAgreed: readonly unknown[];
  readonly rejectedAgreed: readonly unknown[];
  readonly disagreements: readonly Disagreement[];
}

function judgeWithLuq(shape: BenchShape, value: unknown): boolean {
  return shape.buildValidator().validate(value).valid;
}

/**
 * For one shape and one competitor, compares every value in the accepted and
 * rejected pools.
 *
 * The Luq side is built once and reused. Speed does not matter here, this
 * being no measurement, but a fresh validator per value would leave it
 * ambiguous which validator gave an answer.
 */
export function measureShapeAgreement(
  shape: BenchShape,
  competitor: Competitor
): ShapeAgreement | undefined {
  const subject = competitor.subjects[shape.name];
  if (subject === undefined) return undefined;

  const validator = shape.buildValidator();
  const agreed: unknown[] = [];
  const acceptedAgreed: unknown[] = [];
  const rejectedAgreed: unknown[] = [];
  const disagreements: Disagreement[] = [];

  // Which pool a value came from is not the same question as what Luq answers
  // about it: a value in `rejectedValues` that Luq accepts is a disagreement
  // with the shape, not a rejection. The split below follows the ANSWER, which
  // is what decides how much error-construction work each side does.
  for (const value of [...shape.acceptedValues, ...shape.rejectedValues]) {
    const luqSaid = validator.validate(value).valid;
    if (subject.check(value) !== luqSaid) {
      disagreements.push({ value, luqSaid });
      continue;
    }
    agreed.push(value);
    (luqSaid ? acceptedAgreed : rejectedAgreed).push(value);
  }

  return {
    shape: shape.name,
    competitor: competitor.name,
    agreedValues: Object.freeze(agreed),
    acceptedAgreed: Object.freeze(acceptedAgreed),
    rejectedAgreed: Object.freeze(rejectedAgreed),
    disagreements: Object.freeze(disagreements),
  };
}

export function measureAllAgreement(
  competitors: readonly Competitor[]
): readonly ShapeAgreement[] {
  const results: ShapeAgreement[] = [];
  for (const shape of BENCH_SHAPES) {
    for (const competitor of competitors) {
      const agreement = measureShapeAgreement(shape, competitor);
      if (agreement !== undefined) results.push(agreement);
    }
  }
  return Object.freeze(results);
}

/** Takes the Luq verdict once, to be reused. */
export { judgeWithLuq };
