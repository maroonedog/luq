// ===========================================================================
// THE shared grammar fixture.
//
// One table drives BOTH directions of the path grammar:
//   - the runtime parser (parseFieldPath), exercised in parse-field-path.test.ts
//   - the type-level parser (ParsePath), exercised by NoGrammarDrift below,
//     which is derived from this very table rather than restated.
//
// ts-jest typechecks this file when the test suite imports it, so a divergence
// between the two parsers is a FAILING TEST, not a silent difference. The
// failure names the offending path: GrammarDrift resolves to the path literal
// whose two parses disagree.
// ===========================================================================
import type {
  ParsePath,
  PathSegment,
} from "../../../src/path/path-segment.types";

export const PATH_GRAMMAR_TABLE = [
  { path: "name", segments: [{ kind: "key", key: "name" }] },
  {
    path: "a.b.c",
    segments: [
      { kind: "key", key: "a" },
      { kind: "key", key: "b" },
      { kind: "key", key: "c" },
    ],
  },
  {
    path: "tags[*]",
    segments: [{ kind: "key", key: "tags" }, { kind: "each" }],
  },
  {
    path: "items[*].name",
    segments: [
      { kind: "key", key: "items" },
      { kind: "each" },
      { kind: "key", key: "name" },
    ],
  },
  {
    // The regression the legacy tree could not survive: [key, each, each],
    // in that order, on both sides.
    path: "matrix[*][*]",
    segments: [
      { kind: "key", key: "matrix" },
      { kind: "each" },
      { kind: "each" },
    ],
  },
  {
    path: "orders[*].items[*].productId",
    segments: [
      { kind: "key", key: "orders" },
      { kind: "each" },
      { kind: "key", key: "items" },
      { kind: "each" },
      { kind: "key", key: "productId" },
    ],
  },
  {
    path: "departments[*].teams[*]",
    segments: [
      { kind: "key", key: "departments" },
      { kind: "each" },
      { kind: "key", key: "teams" },
      { kind: "each" },
    ],
  },
  {
    path: "user.address.street",
    segments: [
      { kind: "key", key: "user" },
      { kind: "key", key: "address" },
      { kind: "key", key: "street" },
    ],
  },
] as const;

type Entries = typeof PATH_GRAMMAR_TABLE;

/** Compile-time proof that the table's segment column really is the runtime
 *  vocabulary and not some lookalike that only happens to compare equal. */
type SegmentsAreRuntimeVocabulary =
  Entries[number]["segments"][number] extends PathSegment ? true : never;
export const TABLE_IS_RUNTIME_VOCABULARY: SegmentsAreRuntimeVocabulary = true;

type AsTypeSegment<S> = S extends {
  readonly kind: "key";
  readonly key: infer K extends string;
}
  ? { readonly key: K }
  : { readonly each: true };

type AsTypeSegments<S extends readonly unknown[]> = {
  -readonly [I in keyof S]: AsTypeSegment<S[I]>;
};

type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2
    ? true
    : false;

/** Distributes over the rows, so the result is the path literal of every row
 *  whose two parses disagree — a regression NAMES the offender. */
type DriftOf<R> = R extends {
  readonly path: infer P extends string;
  readonly segments: infer S extends readonly unknown[];
}
  ? Equals<ParsePath<P>, AsTypeSegments<S>> extends true
    ? never
    : P
  : never;

export type GrammarDrift = DriftOf<Entries[number]>;

/** THE anti-drift gate. Break either parser and this stops compiling. */
export type NoGrammarDrift =
  Equals<GrammarDrift, never> extends true ? true : GrammarDrift;
export const NO_GRAMMAR_DRIFT: NoGrammarDrift = true;
