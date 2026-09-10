// ===========================================================================
// L3  src/chain/chain-node-store.ts — ノードに紐づくものを、ノードの外に持つ。
//
// ノードへ直接生やさないのは create-chain-node.ts の元からの判断で、理由も
// そこに書いてある: ノードは型が宣言したメンバーだけを持ち、読み戻すのに
// アサーションも実行時の形検査も要らない。
//
// 持つのはルール列だけである。以前は宣言 (DeclaredCall) も同じ表に入れて
// いたが、宣言は declaration-recorder.port.ts へ委譲した。実行時が一度も
// 読まないものを中核に置かない、というのが分けた理由で、表を2つにした分の
// 費用は書き出しを使う側だけが払う。
// ===========================================================================
import type { Rule } from "../plugin-kit/compiled-rule";

const rulesByNode = new WeakMap<object, readonly Rule[]>();

/** ノードを作った側だけが呼ぶ。凍結の直前に一度だけ。 */
export function rememberChainNode(node: object, rules: readonly Rule[]): void {
  rulesByNode.set(node, rules);
}

/** 連鎖から出る唯一の道: ノードでない値には undefined。 */
export function readChainNode(candidate: unknown): readonly Rule[] | undefined {
  if (typeof candidate !== "object" || candidate === null) return undefined;
  return rulesByNode.get(candidate);
}
