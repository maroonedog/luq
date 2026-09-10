// ===========================================================================
// L3  src/chain/collect-field-rules.ts
//
// The ONE place a field's `define` callback is executed. It runs exactly once,
// against one freshly built `b`, and the ordered rule list it produced is
// frozen and handed on to L4. Nothing downstream ever calls it again, so a
// callback with a side effect cannot fire twice.
//
// 宣言 (何が何の引数で呼ばれたか) も同じ一度から取る。二度目を走らせれば
// 副作用が二度起きるので、読むならここしかない。
// ===========================================================================
import type { Rule } from "../plugin-kit/compiled-rule";
import type { PluginBag } from "./plugin-bag.types";
import type { AnyChain } from "./field-chain.types";
import type { FieldSlots } from "./field-slots.types";
import type { ChainBuildContext } from "./create-chain-node";
import { readChainNode } from "./chain-node-store";
import type { DeclaredCall } from "./declared-call.types";
import { createFieldSlots } from "./create-field-slots";

/** 一度きりの実行が生んだもの。ルールは実行時が、宣言は書き出す側が読む。 */
export interface FieldChainOutcome {
  readonly rules: readonly Rule[];
  /**
   * null は「宣言を控えていない」で、空配列の「宣言が無い」とは別である。
   * 連鎖を通らずにルールを組み立てる経路 (fromJsonSchema) が null を返す。
   * 一つにすると、書き出す側が「制約の無いスキーマ」を自信満々に返す。
   */
  readonly calls: readonly DeclaredCall[] | null;
}

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
): FieldChainOutcome {
  const chain = define(createFieldSlots<TRoot, B, TField>(bag, context));
  const memo = readChainNode(chain);
  if (memo === undefined) throw new FieldChainResultError(context.fieldPath);
  return Object.freeze({
    rules: Object.freeze(memo.rules.slice()),
    calls: Object.freeze(memo.calls.slice()),
  });
}
