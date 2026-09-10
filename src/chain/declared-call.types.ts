// ===========================================================================
// L3  src/chain/declared-call.types.ts — 何が呼ばれたかを、値のまま控える。
//
// THE DEFECT THIS FILE EXISTS TO KILL: `.min(3)` の 3 は、プラグインの
// `build(ctx, min)` がクロージャに閉じ込めて Rule を返した時点で消える。
// コンパイル済みのルールに残るのは `code` と関数だけで、3 はどこにも無い。
// JSON Schema を**書き出す**側はその 3 を必要とするので、連鎖がメソッドを
// 呼んだその場で控える。
//
// 実行時は一切読まない。build() が一度作り、書き出しを頼まれたときだけ
// 読まれる。ルール列とは本数が揃わない (judgesNull なプラグインは
// ルールを2本足すが、呼ばれたメソッドは1つである)。
// ===========================================================================
import type { TypeName } from "../types";

/** 連鎖メソッドが一度呼ばれたこと。 */
export interface DeclaredCall {
  readonly pluginName: string;
  readonly method: string;
  readonly slot: TypeName;
  /**
   * `resolveArguments` を通したあとの値。
   *
   * 宣言時の値そのものであって、正規化はしない。`pattern` は RegExp のまま
   * 入る。JSON Schema がどう書くかは書き出す側の仕事で、ここで文字列に
   * しておくと、書き出さない利用者にその変換を払わせることになる。
   */
  readonly args: readonly unknown[];
}
