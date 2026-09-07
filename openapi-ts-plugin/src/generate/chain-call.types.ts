// ===========================================================================
// openapi-ts-plugin/src/generate/chain-call.types.ts
//
// 生成されるチェーン1本分の中間表現。文字列を直接組み立てず一度ここを通すのは、
// 「どのプラグインを import する必要があるか」を後から数えられるようにするため。
// 文字列連結だけで書くと、import 漏れが実行時ではなく利用者の tsc で初めて出る。
// ===========================================================================

/** チェーンに生えるメソッド1回分の呼び出し。 */
export interface ChainCall {
  /** 呼ぶメソッド名。例 "min"。 */
  readonly method: string;
  /** そのまま出力する引数のソース。例 ["3"]。空なら `.min()`。 */
  readonly args: readonly string[];
  /**
   * このメソッドを生やすプラグインの export 名。例 "stringMinPlugin"。
   * import 文はこれを集めて作る。
   */
  readonly pluginExport: string;
  /** import 元のサブパス。例 "@maroonedog/luq/plugins/stringMin"。 */
  readonly pluginSubpath: string;
}

/** 1フィールド分の宣言。`.v(path, b => b.<slot>....)` になる。 */
export interface FieldChain {
  /** `.v()` の第1引数。例 "items[*].sku"。 */
  readonly path: string;
  /** `b.` のあとに来るスロット名。例 "string"。 */
  readonly slot: string;
  readonly calls: readonly ChainCall[];
  /**
   * 出力しなかったキーワードと理由。捨てたことを黙らせないために持ち回る。
   * 生成物のコメントにも出す。
   */
  readonly skipped: readonly SkippedKeyword[];
}

export interface SkippedKeyword {
  readonly keyword: string;
  readonly reason: string;
}

export interface GeneratedModule {
  readonly source: string;
  /** 生成に使ったプラグインの export 名（重複なし、ソート済み）。 */
  readonly pluginExports: readonly string[];
  /** 全フィールド分の取りこぼし。呼び出し側が報告に使う。 */
  readonly skipped: readonly (SkippedKeyword & { readonly path: string })[];
}
