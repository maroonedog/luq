import type { ParsePath, Segment } from "./path-segment.types";
import type { IsOpaqueObject } from "./opaque-object.types";
import type { ElementOf } from "./element-of.types";

/** `unknown extends T` is tested BEFORE NonNullable, because
 *  `NonNullable<unknown>` is `{}` since TS 4.9 and would otherwise collapse
 *  every Record<string, unknown> subtree to never on the second segment. */
type ReadKey<T, K extends string> = unknown extends T
  ? unknown
  : NonNullable<T> extends infer U
    ? U extends readonly unknown[]
      ? never
      : IsOpaqueObject<U> extends true
        ? never
        : U extends object
          ? K extends keyof U
            ? U[K]
            : never
          : never
    : never;

type WalkSegments<T, S extends readonly Segment[]> = S extends readonly [
  infer H,
  ...infer R extends readonly Segment[],
]
  ? H extends { readonly each: true }
    ? WalkSegments<ElementOf<T>, R>
    : H extends { readonly key: infer K extends string }
      ? WalkSegments<ReadKey<T, K>, R>
      : never
  : T;

/** The declared type at P. Optionality survives on the LAST segment only, so
 *  the chain can observe presence type-state while intermediate steps stay
 *  total: ValueAtPath<T,"opt"> is `Address | undefined`, ValueAtPath<T,
 *  "opt.street"> is `string`. */
export type ValueAtPath<T, P extends string> = WalkSegments<T, ParsePath<P>>;

/** Maps a tuple of path literals to an object of their resolved value types. */
export type PickPaths<T, P extends readonly string[]> = {
  readonly [K in P[number]]: ValueAtPath<T, K>;
};
