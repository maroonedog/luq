import type {
  GuardOut,
  StitchOut,
  TransformOut,
} from "../plugin-kit/marker.types";
import type { BundleChain, BundlePaths } from "./bundle-paths.types";
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
        : // 引数2の型が引数1で決まる、という形はここでしか書けない。
          // ResolveArgs は各引数を固定の TRoot/TValue に対して独立に解決する
          // ので、引数どうしの依存を表せない。GuardOut と同じ扉である。
          //
          // `const M` が対応表をリテラルで捕まえ、BundleOf がそこから束の型を
          // 組む。別名を経由するのは飾りではない: 束をパス文字列でキーすると
          // `.v("user.name")` がパスとして構造解釈され、束の中を探しに行って
          // 見つからない。別名は素の識別子なので、その衝突が起きない。
          [Sig["out"]] extends [StitchOut]
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
