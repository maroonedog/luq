import type { ArrayItemContext, Present } from "../types";
import type {
  ElementChain,
  FieldRef,
  FieldRefs,
  GuardOut,
  MarkerRecord,
  NarrowedChain,
  PresenceShift,
  PropertyKeyChain,
  PropertyValueChain,
  RootPredicate,
  RootReader,
  SelfGuard,
  SelfReader,
  SelfValue,
  TransformOut,
  Unchanged,
} from "../plugin-kit/marker.types";
import type { ElementOf } from "../path/element-of.types";
import type { PropertyValueOf } from "../path/property-value-of.types";
import type { FieldPath } from "../path/field-path.types";
import type { PluginBag } from "./plugin-bag.types";
import type { AnyChain } from "./field-chain.types";
import type { FieldSlots } from "./field-slots.types";
import type {
  AllowNull,
  ChainState,
  ExcludeMissing,
  ExcludeNull,
  ExcludeUndefined,
} from "./chain-state.types";

/** Optional tuple elements are stripped of `undefined` before matching. */
export type ResolveArg<
  A,
  B extends PluginBag,
  TRoot,
  TValue,
  TState extends ChainState,
> = [undefined] extends [A]
  ? ResolveOneArg<Exclude<A, undefined>, B, TRoot, TValue, TState> | undefined
  : ResolveOneArg<A, B, TRoot, TValue, TState>;

type ResolveOneArg<
  A,
  B extends PluginBag,
  TRoot,
  TValue,
  TState extends ChainState,
> = [A] extends [FieldRef]
  ? FieldPath<TRoot> & string
  : [A] extends [FieldRefs]
    ? readonly (FieldPath<TRoot> & string)[]
    : [A] extends [RootPredicate]
      ? (root: TRoot, item?: ArrayItemContext) => boolean
      : [A] extends [RootReader<infer R>]
        ? (root: TRoot) => R
        : [A] extends [SelfReader<infer R>]
          ? (value: Present<TValue, TState>) => R
          : [A] extends [SelfGuard]
            ? (value: Present<TValue, TState>) => boolean
            : [A] extends [NarrowedChain]
              ? (b: FieldSlots<TRoot, B, Present<TValue, TState>>) => AnyChain
              : [A] extends [SelfValue]
                ? Present<TValue, TState>
                : [A] extends [ElementChain]
                  ? (b: FieldSlots<TRoot, B, ElementOf<TValue>>) => AnyChain
                  : // The two subjects ElementOf and Present cannot produce. The property VALUE
                    // is T[keyof T]; the property KEY is always a string and is not reachable
                    // from TValue at all.
                    [A] extends [PropertyValueChain]
                    ? (
                        b: FieldSlots<
                          TRoot,
                          B,
                          PropertyValueOf<Present<TValue, TState>>
                        >
                      ) => AnyChain
                    : [A] extends [PropertyKeyChain]
                      ? (b: FieldSlots<TRoot, B, string>) => AnyChain
                      : [A] extends [readonly unknown[]]
                        ? {
                            [I in keyof A]: ResolveArg<
                              A[I],
                              B,
                              TRoot,
                              TValue,
                              TState
                            >;
                          }
                        : // The same recursion for a KEYED set of sub-chains (patternProperties,
                          // dependentSchemas). A key set is not a tuple, so the array recursion above
                          // never reached it and the raw marker leaked into the call site.
                          [A] extends [MarkerRecord]
                          ? {
                              readonly [K in keyof A]: ResolveArg<
                                A[K],
                                B,
                                TRoot,
                                TValue,
                                TState
                              >;
                            }
                          : A;

export type ResolveArgs<
  A extends readonly unknown[],
  B extends PluginBag,
  TRoot,
  TValue,
  TState extends ChainState,
> = { [I in keyof A]: ResolveArg<A[I], B, TRoot, TValue, TState> };

/** Presence shifts go through the NAMED operators over ChainState. */
export type ResolveOut<O, TValue, TState extends ChainState> = [O] extends [
  Unchanged,
]
  ? [TValue, TState]
  : [O] extends [TransformOut]
    ? [unknown, TState]
    : [O] extends [GuardOut]
      ? [TValue, TState]
      : [O] extends [PresenceShift<"excludeMissing">]
        ? [TValue, ExcludeMissing<TState>]
        : [O] extends [PresenceShift<"excludeUndefined">]
          ? [TValue, ExcludeUndefined<TState>]
          : [O] extends [PresenceShift<"excludeNull">]
            ? [TValue, ExcludeNull<TState>]
            : [O] extends [PresenceShift<"allowNull">]
              ? [TValue | null, AllowNull<TState>]
              : [O, TState];
