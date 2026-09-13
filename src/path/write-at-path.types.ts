// ===========================================================================
// L1  src/path/write-at-path.types.ts
//
// The mirror of ValueAtPath: reading a path answers a type, and writing one
// answers the whole object with that path's type replaced.
//
// It exists because `parse()` was returning the wrong type. A transform is
// allowed to change what a field holds — `.transform((s) => new Date(s))` on a
// `string` field leaves a `Date` behind — and the value that comes back from
// parse() really is the transformed one. Its TYPE said `string`, so
// `parsed.data.when.toUpperCase()` compiled and then threw at run time. The
// type was not merely imprecise, it was wrong in the direction that costs a
// caller something.
//
// Homomorphic on purpose: `{ [P in keyof T]: ... }` preserves `?` and
// `readonly`, so rewriting one member of a type does not quietly widen the
// rest of it. An `Omit<T, K> & { [P in K]: V }` spelling loses both.
// ===========================================================================
import type { ParsePath, Segment } from "./path-segment.types";

/**
 * Walks the parsed segments and replaces the type at the end of them.
 *
 * A segment that does not apply — a key the object does not have, a `[*]` on
 * something that is not an array — leaves `T` alone rather than collapsing it
 * to `never`. The path was already checked against the type by FieldPath when
 * the field was declared; if one reaches here that cannot be walked, the right
 * answer is the type the caller already had, not an error reported twice.
 */
type WriteSegments<T, S extends readonly Segment[], V> = S extends readonly [
  infer H,
  ...infer R extends readonly Segment[],
]
  ? H extends { readonly each: true }
    ? T extends readonly (infer E)[]
      ? WriteSegments<E, R, V>[]
      : T
    : H extends { readonly key: infer K extends string }
      ? K extends keyof T
        ? { [P in keyof T]: P extends K ? WriteSegments<T[P], R, V> : T[P] }
        : T
      : T
  : V;

/** `WriteAtPath<{ user: { name: string } }, "user.name", number>`. */
export type WriteAtPath<T, P extends string, V> = WriteSegments<
  T,
  ParsePath<P>,
  V
>;

/**
 * One field whose chain leaves a different type behind than it was given.
 *
 * A tuple rather than an object map, so applying them is a plain recursion
 * over a list. Folding a union of keys instead would mean turning that union
 * into a tuple, which costs far more instantiations — and this list is carried
 * by every `.v()` call on the builder, where the compiler already runs out of
 * stack at a few hundred.
 */
export type ParsedOverride = readonly [string, unknown];

/** Applies every recorded override to `T`, in declaration order. */
export type ApplyParsedOverrides<
  T,
  L extends readonly ParsedOverride[],
> = L extends readonly [
  readonly [infer P extends string, infer V],
  ...infer R extends readonly ParsedOverride[],
]
  ? ApplyParsedOverrides<WriteAtPath<T, P, V>, R>
  : T;

/** Mutually assignable: the chain handed back what it was given. */
type SameType<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;

/**
 * Adds a field to the override list, or does not.
 *
 * The "or does not" is what keeps this free for the validators that declare no
 * transform at all, which is nearly all of them: the list stays the empty
 * tuple, `ApplyParsedOverrides` returns `T` on its first conditional, and
 * nothing recursive is ever instantiated.
 *
 * An `unknown` output records nothing either, and that is the more important
 * of the two. `unknown` is what a chain whose type was erased answers — a
 * field rule stores its chain as `AnyChain` — and it means "nothing was
 * learned here", not "this field now holds unknown". Recording it would make
 * `parse()`'s type WORSE than the one this file exists to correct.
 */
export type RecordParsedOverride<
  L extends readonly ParsedOverride[],
  K extends string,
  TIn,
  TOut,
> = unknown extends TOut
  ? L
  : SameType<TIn, TOut> extends true
    ? L
    : readonly [...L, readonly [K, TOut]];
