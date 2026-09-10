// ===========================================================================
// L6  src/builder/field-options.types.ts
// The third argument of `.v()`. It is a FIELD CONFIGURATION, never a Rule:
// compile/validation-plan.types.ts says so, and that is why `defaultOf` and
// `applyDefaultToNull` sit on FieldDeclaration rather than in its rule list.
//
// Legacy shape (should-preserve, docs/legacy-spec/documented-promises.md:211):
//     { default?: T | (() => T); applyDefaultToNull?: boolean }
// The factory form is widened to `(root: unknown) => T` so a default can read
// the object it is filling in; a legacy zero-argument factory still fits.
// ===========================================================================

/** The lazy form of a default. A zero-argument function is assignable to it. */
export type DefaultFactory<TValue> = (root: unknown) => TValue;

/**
 * 判定より前に値を整える。
 *
 * 引数も返り値も `unknown` である。整形の入力は**まだ検証されていない値**で、
 * フォームは数値の欄にも文字列を寄こす — `"42"` → `42` はこの層の主用途
 * なので、`(value: TValue) => TValue` と型を付けるのは嘘になる。返り値を
 * 判定するのは規則の側であり、型ではない。
 *
 * undefined と null には**呼ばれない**。理由は field-options.types.ts の
 * `normalize` の項に書いた。
 */
export type FieldNormalizer = (value: unknown) => unknown;

export interface FieldOptions<TValue> {
  /**
   * Substituted before ANY rule looks at the value, so validate() and parse()
   * judge the same thing; only parse() writes it back.
   */
  readonly default?: TValue | DefaultFactory<TValue>;
  /** Defaults to true — a declared null is replaced, matching 1.x. */
  readonly applyDefaultToNull?: boolean;
  /**
   * 判定より前に値を整える。default の直後、presence の直前に走る。
   *
   * `default` と同じ約束を持つ: validate() と parse() は同じ値を判定し、
   * 書き戻すのは parse() だけである。だから validate() の結果と parse() の
   * 結果が食い違うことはない。
   *
   * **undefined と null には呼ばれない。** `(v) => String(v).trim()` と書いた
   * ときに undefined が `"undefined"` になり、それが `.required()` を
   * 通ってしまうのを防ぐため。不在を扱うのは `default` の仕事で、
   * normalize が扱うのは**在る値**である。この分担があるので、利用者は
   * 整形関数の中で null 検査を書かなくてよい。
   *
   * 空白だけの文字列を落とす用途はこの順序で成り立つ:
   * `"  "` → trim → `""` → presence が空文字を不在とみなす → required が鳴る。
   */
  readonly normalize?: FieldNormalizer;
}
