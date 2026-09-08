// ===========================================================================
// L7  src/plugins/object-additional-properties/select-additional-keys.ts
//
// 「additional なキー」を選ぶ規則。boolean 形とスキーマ形の両方が使う。
//
// Draft-07 §6.5.4 は additionalProperties の対象を「properties にも
// patternProperties にも該当しないキー」と定めている。パターンを見落とすと
// `{"patternProperties":{"^v":{}},"additionalProperties":false}` が
// {"vroom":2} を誤って拒否する (スイートの
// "patternProperties are not additional properties" がそれを突く)。
// ===========================================================================

/**
 * パターンは build 時に一度だけコンパイルする。実行時は回すだけ、という
 * 設計に合わせるためで、キーごとに new RegExp すると O(キー数 x パターン数)
 * のコンパイルが毎回走る。
 *
 * 壊れた正規表現は無視する。スキーマ側の誤りでビルド全体を落とすより、
 * そのパターンが誰にも一致しないほうがまし (Draft-07 は ECMA-262 の
 * 正規表現を求めるが、方言差で通らないものが現実には来る)。
 */
export function compilePatterns(
  patterns: readonly string[] | undefined
): readonly RegExp[] {
  if (patterns === undefined || patterns.length === 0) return Object.freeze([]);
  const compiled: RegExp[] = [];
  for (const pattern of patterns) {
    try {
      compiled.push(new RegExp(pattern, "u"));
    } catch {
      try {
        // "u" が付くと通らない書き方が現実にはある。付けずにもう一度試す。
        compiled.push(new RegExp(pattern));
      } catch {
        // どちらでも駄目なら、このパターンは一致しないものとして扱う。
      }
    }
  }
  return Object.freeze(compiled);
}

/**
 * 宣言済みのキー名にも、どのパターンにも該当しないキーを返す。
 * 返る配列は入力の列挙順を保つ (issue のメッセージが安定する)。
 */
export function selectAdditionalKeys(
  value: Readonly<Record<string, unknown>>,
  known: ReadonlySet<string>,
  patterns: readonly RegExp[]
): readonly string[] {
  return Object.keys(value).filter(
    (key) => !known.has(key) && !patterns.some((pattern) => pattern.test(key))
  );
}
