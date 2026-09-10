// ===========================================================================
// L3  src/chain/chain-node-store.ts — ノードに紐づくものを、ノードの外に持つ。
//
// ノードへ直接生やさないのは create-chain-node.ts の元からの判断で、理由も
// そこに書いてある: ノードは型が宣言したメンバーだけを持ち、読み戻すのに
// アサーションも実行時の形検査も要らない。
//
// ルールと宣言を**一つの表**に入れている。二つ持つと、同じ型検査を二度
// 書くことになり、配布物で実測 30 B ほど増える。1本にすれば読み戻しも
// 一度で済む。
//
// 二つの列は本数が揃わない。`judgesNull` なプラグインは1回の呼び出しで
// ルールを2本足すので、添字で対応づけてはならない。
// ===========================================================================
import type { Rule } from "../plugin-kit/compiled-rule";
import type { DeclaredCall } from "./declared-call.types";

/** ノード1つが覚えていること。 */
export interface ChainNodeMemo {
  readonly rules: readonly Rule[];
  readonly calls: readonly DeclaredCall[];
}

const memoByNode = new WeakMap<object, ChainNodeMemo>();

/** ノードを作った側だけが呼ぶ。凍結の直前に一度だけ。 */
export function rememberChainNode(node: object, memo: ChainNodeMemo): void {
  memoByNode.set(node, memo);
}

/** 連鎖から出る唯一の道: ノードでない値には undefined。 */
export function readChainNode(candidate: unknown): ChainNodeMemo | undefined {
  if (typeof candidate !== "object" || candidate === null) return undefined;
  return memoByNode.get(candidate);
}
