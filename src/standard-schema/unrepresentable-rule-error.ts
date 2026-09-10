// ===========================================================================
// L10 src/standard-schema/unrepresentable-rule-error.ts
//
// JSON Schema に書けない宣言に出会ったときの既定の答えは、throw である。
//
// 黙って落とす選択肢は取らない。書き出した JSON Schema は受け取った側が
// **検証に使う**。`.custom()` を落とした結果は、通ってはいけない値を通す
// スキーマであり、しかも落としたことがどこにも出ない。制約が減ったことに
// 気づけるのは、それで事故が起きたあとになる。
//
// 落として構わない利用者 — 書き出し先が人間向けの文書やフォームの見た目で、
// 検証には使わない — は libraryOptions で明示的に頼める。仕様が
// libraryOptions をベンダー独自の引数の置き場として用意しているのは、
// まさにこういう取り決めのためである。既定を緩い側に置かないのが肝で、
// 緩いほうを選んだことが呼び出し側のコードに残る。
// ===========================================================================

export class UnrepresentableRuleError extends Error {
  constructor(
    readonly fieldPath: string,
    readonly pluginName: string,
    readonly reason: string
  ) {
    super(
      `"${fieldPath}" declares ${pluginName}, which Luq cannot express in ` +
        `JSON Schema: ${reason}. Pass ` +
        `libraryOptions: { unrepresentable: "omit" } to drop it instead — ` +
        `the emitted schema then accepts values this validator rejects.`
    );
    this.name = "UnrepresentableRuleError";
  }
}

/** 書けない宣言に出会ったときの振る舞い。既定は "throw"。 */
export type UnrepresentablePolicy = "throw" | "omit";

/**
 * `libraryOptions` から方針を読む。
 *
 * 知らない値は throw に倒す。綴りを間違えた `omit` が黙って厳しい側に
 * 落ちるのは正しいが、黙って緩い側に落ちるのは事故になる。
 */
export function readUnrepresentablePolicy(
  libraryOptions: Record<string, unknown> | undefined
): UnrepresentablePolicy {
  return libraryOptions?.["unrepresentable"] === "omit" ? "omit" : "throw";
}
