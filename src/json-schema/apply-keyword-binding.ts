// ===========================================================================
// L8  src/json-schema/apply-keyword-binding.ts
// The converter's single call site. It cannot type-check unless the bound
// method really is on the chain with exactly the bound argument tuple.
// ===========================================================================
import type { TypeName } from "../types";
import type {
  ArgsOf,
  BindableMethod,
  BoundMethod,
  BoundPlugin,
} from "./json-schema-bag.types";
import type { KeywordBinding } from "./keyword-binding.types";
import type { ChainMarks } from "../chain/field-chain.types";
import type { ChainState } from "../chain/chain-state.types";

/**
 * The marker-free slice of FieldChain the converter is allowed to drive.
 *
 * `__chain` is carried through deliberately: it is what makes the slice an
 * `AnyChain`, so the value a converter hands back from `.v(path, b => ...)`
 * needs NO cast to be accepted. Drop it and step 25's single call site has to
 * assert its way back onto the builder, which is the sort of hole this layer
 * exists to close.
 */
export type ConverterChain<S extends TypeName> = {
  readonly [M in BindableMethod<S> & BoundMethod<S>]: (
    ...args: ArgsOf<BoundPlugin<S, M>>
  ) => ConverterChain<S>;
} & { readonly __chain: ChainMarks<unknown, ChainState> };

export function applyKeywordBinding<
  S extends TypeName,
  M extends BindableMethod<S> & BoundMethod<S>,
  TName extends string,
  V,
>(
  chain: ConverterChain<S>,
  binding: KeywordBinding<S, M, TName, ArgsOf<BoundPlugin<S, M>>, V>,
  keywordValue: V
): ConverterChain<S> {
  const method: (...args: ArgsOf<BoundPlugin<S, M>>) => ConverterChain<S> =
    chain[binding.method];
  return method(...binding.toArguments(keywordValue));
}
