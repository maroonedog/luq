import type { IsOpaqueObject } from "./opaque-object.types";
import type { PathDepthBudget, PreviousDepth } from "./path-depth.types";
import type { ElementOf } from "./element-of.types";

/** The union of legal path literals for T. `[*]` is the only array wildcard and
 *  array members are never enumerated, which removes `items.name`,
 *  `items[0].name`, `tags.length` and `items.map` with ONE rule. */
export type FieldPath<T, D extends number = PathDepthBudget> = RecordPaths<
  T,
  D
>;

type RecordPaths<T, D extends number> =
  NonNullable<T> extends infer U
    ? U extends readonly unknown[]
      ? never
      : IsOpaqueObject<U> extends true
        ? never
        : U extends object
          ? {
              [K in Extract<keyof U, string>]-?:
                | K
                | DescendantPaths<K, U[K], D>;
            }[Extract<keyof U, string>]
          : never
    : never;

type DescendantPaths<Prefix extends string, V, D extends number> = D extends 0
  ? never
  : NonNullable<V> extends infer U
    ? U extends readonly unknown[]
      ?
          | `${Prefix}[*]`
          | DescendantPaths<`${Prefix}[*]`, ElementOf<U>, PreviousDepth[D]>
      : IsOpaqueObject<U> extends true
        ? never
        : U extends object
          ? JoinPath<Prefix, RecordPaths<U, PreviousDepth[D]>>
          : never
    : never;

type JoinPath<Prefix extends string, Sub> = Sub extends string
  ? `${Prefix}.${Sub}`
  : never;
