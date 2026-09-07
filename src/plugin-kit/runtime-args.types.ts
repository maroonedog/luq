import type {
  ElementChain,
  FieldRef,
  FieldRefs,
  MarkerRecord,
  NarrowedChain,
  PresenceShift,
  PresenceShiftKind,
  PropertyKeyChain,
  PropertyValueChain,
  RootPredicate,
  RootReader,
  SelfGuard,
  SelfReader,
  SelfValue,
  TransformOut,
} from "./marker.types";
import type { ArrayItemContext } from "../types";
import type { PresenceRule, Rule, TransformRule } from "./compiled-rule";

export type RootPredicateFn = (
  root: unknown,
  item?: ArrayItemContext
) => boolean;
export type RootReaderFn<R> = (root: unknown) => R;
export type SelfReaderFn<R> = (value: unknown) => R;
export type SelfGuardFn = (value: unknown) => boolean;

/**
 * An OPTIONAL tuple element makes `A[I]` be `M | undefined`, which matches no
 * marker branch. Undefined is stripped before matching and re-added afterwards.
 */
export type RuntimeArg<A> = [undefined] extends [A]
  ? ResolveRuntimeArg<Exclude<A, undefined>> | undefined
  : ResolveRuntimeArg<A>;

type ResolveRuntimeArg<A> = [A] extends [FieldRef]
  ? string
  : [A] extends [FieldRefs]
    ? readonly string[]
    : [A] extends [RootPredicate]
      ? RootPredicateFn
      : [A] extends [RootReader<infer R>]
        ? RootReaderFn<R>
        : [A] extends [SelfReader<infer R>]
          ? SelfReaderFn<R>
          : [A] extends [SelfGuard]
            ? SelfGuardFn
            : [A] extends [SelfValue]
              ? unknown
              : [A] extends [ElementChain]
                ? readonly Rule[]
                : [A] extends [NarrowedChain]
                  ? readonly Rule[]
                  : [A] extends [PropertyValueChain]
                    ? readonly Rule[]
                    : [A] extends [PropertyKeyChain]
                      ? readonly Rule[]
                      : // Structural recursion written as a MAPPED type, so a tuple stays a tuple.
                        [A] extends [readonly unknown[]]
                        ? { [I in keyof A]: RuntimeArg<A[I]> }
                        : // The same recursion for a KEYED set of sub-chains (patternProperties,
                          // dependentSchemas). Without it the marker leaked straight into build().
                          [A] extends [MarkerRecord]
                          ? { readonly [K in keyof A]: RuntimeArg<A[K]> }
                          : A;

export type RuntimeArgs<A extends readonly unknown[]> = {
  [I in keyof A]: RuntimeArg<A[I]>;
};

/** The runtime counterpart of the OUTPUT markers. */
export type RuleForOut<O> = [O] extends [TransformOut]
  ? TransformRule
  : [O] extends [PresenceShift<PresenceShiftKind>]
    ? PresenceRule
    : Rule;
