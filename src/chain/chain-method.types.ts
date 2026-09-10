import type {
  BundleOut,
  GuardOut,
  StitchOut,
  TransformOut,
} from "../plugin-kit/marker.types";
import type { BundleChain, BundlePaths } from "./bundle-paths.types";
import type {
  PluginDefinition,
  PluginSignature,
} from "../plugin-kit/plugin-definition";
import type {
  CrossFieldOutcome,
  Present,
  RuleOptions,
  TypeName,
} from "../types";
import type { FieldPath } from "../path/field-path.types";
import type { PickPaths } from "../path/value-at-path.types";
import type { PluginBag } from "./plugin-bag.types";
import type { ChainState, CoverWith } from "./chain-state.types";
import type { ResolveArgs, ResolveOut } from "./resolve-args.types";
import type { AnyChain, FieldChain } from "./field-chain.types";
import type { FieldSlots } from "./field-slots.types";

/** One plugin definition -> one call signature. */
export type ChainMethod<
  P,
  B extends PluginBag,
  S extends TypeName,
  TRoot,
  TValue,
  TState extends ChainState,
> =
  P extends PluginDefinition<
    string,
    string,
    readonly TypeName[],
    infer Sig extends PluginSignature
  >
    ? [Sig["out"]] extends [TransformOut]
      ? <R>(
          map: (value: Present<TValue, TState>) => R,
          options?: RuleOptions<Sig["context"]>
        ) => FieldChain<B, S, TRoot, R, TState>
      : [Sig["out"]] extends [GuardOut]
        ? <X extends Present<TValue, TState>>(
            condition: (value: Present<TValue, TState>) => value is X,
            define: (b: FieldSlots<TRoot, B, X>) => AnyChain,
            options?: RuleOptions<Sig["context"]>
          ) => FieldChain<B, S, TRoot, TValue, CoverWith<TState, X>>
        : // "the second argument's type follows from the first" can only be
          // expressed here. Argument resolution treats each argument
          // independently against a fixed root and value, so it cannot carry a
          // dependency between arguments. Same door the guard arm uses.
          //
          // `const M` captures the table as a literal, and the bundle type is
          // built from it. Going through aliases is not decoration: keyed by
          // path strings, `"user.name"` would be read structurally and looked
          // for inside the flat bundle, where it is not. An alias is a bare
          // identifier, so that collision cannot happen.
          [Sig["out"]] extends [StitchOut]
          ? // Builds the predicate's bundle type from the declared path set.
            // `const F` captures the tuple as a literal, which is what lets
            // the value type be looked up per key rather than falling back to
            // Record<string, unknown>.
            <const F extends readonly (FieldPath<TRoot> & string)[]>(
              fields: F,
              check: (
                fieldValues: PickPaths<TRoot, F>,
                value: Present<TValue, TState>,
                root: TRoot
              ) => CrossFieldOutcome,
              options?: RuleOptions<Sig["context"]>
            ) => FieldChain<B, S, TRoot, TValue, TState>
          : [Sig["out"]] extends [BundleOut]
            ? <const M extends BundlePaths<TRoot>>(
                fields: M,
                define: BundleChain<TRoot, M, B>,
                options?: RuleOptions<Sig["context"]>
              ) => FieldChain<B, S, TRoot, TValue, TState>
            : (
                ...args: [
                  ...ResolveArgs<Sig["args"], B, TRoot, TValue, TState>,
                  options?: RuleOptions<Sig["context"]>,
                ]
              ) => ResolveOut<Sig["out"], TValue, TState> extends [
                infer V,
                infer St extends ChainState,
              ]
                ? FieldChain<B, S, TRoot, V, St>
                : never
    : never;
