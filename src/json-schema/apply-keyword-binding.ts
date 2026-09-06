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

/** The marker-free slice of FieldChain the converter is allowed to drive. */
export type ConverterChain<S extends TypeName> = {
  readonly [M in BindableMethod<S> & BoundMethod<S>]: (
    ...args: ArgsOf<BoundPlugin<S, M>>
  ) => ConverterChain<S>;
};

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
