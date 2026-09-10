// ===========================================================================
// L10 src/standard-schema/declaration-recorder.ts — PORT の実装。
//
// L3 が declaration-recorder.port.ts で宣言した相手が、ここにいる。据える
// のはモジュールの読み込みで、`toStandardJsonSchema` を取り込んだ時点で
// 済んでいる (to-standard-json-schema.ts の先頭)。
//
// 控えはノードごとに WeakMap で持つ。連鎖ノードと同じ寿命になり、中核の
// メンバーは一つも増えない。これは chain/chain-node-store.ts と同じ手で、
// 理由も同じである。
//
// **足すのであって、書き換えない。** 親の控えは読むだけで、子には新しい
// 配列を結び付ける。だから同じ `b` から枝分かれした二本の連鎖は互いを
// 汚さないし、組み立て済みのノードを別の場所で使い回しても控えは動かない。
// ===========================================================================
import type { TypeName } from "../types";
import type { AnyPlugin } from "../plugin-kit/plugin-definition";
import type { DeclaredCall } from "../chain/declared-call.types";
import {
  installDeclarationRecorder,
  type DeclarationRecorder,
} from "../chain/declaration-recorder.port";

const NONE: readonly DeclaredCall[] = Object.freeze([]);

const callsByNode = new WeakMap<object, readonly DeclaredCall[]>();

const recorder: DeclarationRecorder = {
  record(
    parent: object,
    child: object,
    plugin: AnyPlugin,
    slot: TypeName,
    args: readonly unknown[]
  ): void {
    callsByNode.set(child, [
      ...(callsByNode.get(parent) ?? NONE),
      { pluginName: plugin.name, method: plugin.method, slot, args },
    ]);
  },
  inherit(parent: object, child: object): void {
    const calls = callsByNode.get(parent);
    if (calls !== undefined) callsByNode.set(child, calls);
  },
  read(node: object): readonly DeclaredCall[] | undefined {
    return callsByNode.get(node);
  },
};

/**
 * 一度呼べば据わる。冪等 — 同じ実装を同じ場所に置き直すだけである。
 * 呼び出しはモジュールの先頭に置く: build() が走るより前に据わっている
 * 必要があるので、関数の中に隠してはならない。
 */
export function installJsonSchemaDeclarationRecorder(): void {
  installDeclarationRecorder(recorder);
}
