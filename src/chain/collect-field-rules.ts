// ===========================================================================
// L3  src/chain/collect-field-rules.ts
//
// The ONE place a field's `define` callback is executed. It runs exactly once,
// against one freshly built `b`, and the ordered rule list it produced is
// frozen and handed on to L4. Nothing downstream ever calls it again, so a
// callback with a side effect cannot fire twice, and nothing upstream needs to
// know that a chain is anything other than a Rule[] producer.
// ===========================================================================
import type { Rule } from "../plugin-kit/compiled-rule";
import type { PluginBag } from "./plugin-bag.types";
import type { AnyChain } from "./field-chain.types";
import type { FieldSlots } from "./field-slots.types";
import { readChainRules, type ChainBuildContext } from "./create-chain-node";
import { createFieldSlots } from "./create-field-slots";

export class FieldChainResultError extends Error {
  constructor(readonly fieldPath: string) {
    super(
      `The definition of "${fieldPath}" did not return a chain. End it on a ` +
        `slot method, for example \`(b) => b.string.required()\`.`
    );
    this.name = "FieldChainResultError";
  }
}

export function collectFieldRules<TRoot, B extends PluginBag, TField>(
  bag: B,
  context: ChainBuildContext,
  define: (b: FieldSlots<TRoot, B, TField>) => AnyChain
): readonly Rule[] {
  const chain = define(createFieldSlots<TRoot, B, TField>(bag, context));
  const rules = readChainRules(chain);
  if (rules === undefined) throw new FieldChainResultError(context.fieldPath);
  return Object.freeze(rules.slice());
}
