// ===========================================================================
// bench/competitors/competitor.types.ts
//
// Puts every competitor into the one shape this harness can measure.
//
// Checking **whether the verdicts agree** before measuring is this directory's
// most important job. A speed comparison against something that judges
// differently does not produce a slow number, it produces a wrong one. And
// they do disagree: one rejected pool holds an address a loose pattern accepts
// and this library's email rule refuses.
//
// So disagreements are **counted**, not hidden. Only values everyone answers
// the same way are timed, and the rest are reported by count and by value.
// ===========================================================================
import type { BenchShapeName } from "../shapes/bench-shape.types";

/** One competitor's implementation of one shape. */
export interface CompetitorSubject {
  /** Takes a value and answers whether it satisfies that shape's rules. */
  check(value: unknown): boolean;
}

export interface Competitor {
  /** The npm package name, as it appears in the report. */
  readonly name: string;
  /** The version actually measured, read from disk rather than written here. */
  readonly version: string;
  /**
   * Only the shapes that have an implementation; there is no need to fill all
   * of them. ajv, being a JSON Schema library, is really about the jsonSchema
   * shape, and its other shapes are the same rules written as JSON Schema.
   */
  readonly subjects: Partial<Record<BenchShapeName, CompetitorSubject>>;
}
