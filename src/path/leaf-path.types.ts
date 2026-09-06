import type { IsOpaqueObject } from "./opaque-object.types";
import type { PathDepthBudget, PreviousDepth } from "./path-depth.types";
import type { ElementOf } from "./element-of.types";

/** The subset of FieldPath<T> that terminates at a value: the paths `.strict()`
 *  demands a declaration for. */
export type LeafPath<T, D extends number = PathDepthBudget> = RecordLeafPaths<
  T,
  D
>;

export type MissingLeafPaths<T, TDeclared extends string> = Exclude<
  LeafPath<T>,
  TDeclared
>;

/** False for `{}` and for anything with a string index signature. */
type IsEnumerableRecord<U> = [Extract<keyof U, string>] extends [never]
  ? false
  : string extends Extract<keyof U, string>
    ? false
    : true;

type RecordLeafPaths<T, D extends number> =
  NonNullable<T> extends infer U
    ? U extends readonly unknown[]
      ? never
      : IsOpaqueObject<U> extends true
        ? never
        : U extends object
          ? IsEnumerableRecord<U> extends true
            ? {
                [K in Extract<keyof U, string>]-?: LeafPathsBelow<K, U[K], D>;
              }[Extract<keyof U, string>]
            : never
          : never
    : never;

type LeafPathsBelow<Prefix extends string, V, D extends number> = D extends 0
  ? Prefix
  : NonNullable<V> extends infer U
    ? U extends readonly unknown[]
      ? LeafPathsBelow<`${Prefix}[*]`, ElementOf<U>, PreviousDepth[D]>
      : IsOpaqueObject<U> extends true
        ? Prefix
        : U extends object
          ? IsEnumerableRecord<U> extends true
            ? {
                [K in Extract<keyof U, string>]-?: LeafPathsBelow<
                  `${Prefix}.${K}`,
                  U[K],
                  PreviousDepth[D]
                >;
              }[Extract<keyof U, string>]
            : never
          : Prefix
    : never;
