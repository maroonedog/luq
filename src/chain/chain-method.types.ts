import type { GuardOut, TransformOut } from "../plugin-kit/marker.types";
import type {
  PluginDefinition,
  PluginSignature,
} from "../plugin-kit/plugin-definition";
import type { Present, RuleOptions, TypeName } from "../types";
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
