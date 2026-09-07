// ===========================================================================
// scripts/doc-examples/find-template-literal-constants.ts
//
// Astro のフロントマターに置かれた `const xExample = ` + テンプレート文字列 を
// 取り出す。docs-site のコード例はすべてこの形で書かれており、テンプレート側は
// `<CodeBlock code={xExample} />` で参照するだけなので、コード例の実体は
// ここでしか定義されない。
//
// テンプレート文字列を正規表現で切らないのは、例の中に `${...}` 補間や
// エスケープした backtick が現れるためである（メッセージファクトリの例が
// まさにそれ）。開き backtick から1文字ずつ走査して閉じ位置を決める。
// ===========================================================================

/** フロントマター中のテンプレート文字列定数1つ分。`startLine` は 1 始まり。 */
export interface TemplateLiteralConstant {
  readonly name: string;
  readonly startLine: number;
  readonly code: string;
  /**
   * エスケープされていない `${` を含むか。含むならコードはビルド時にしか
   * 決まらないので、静的な型検査には掛けられない（PluginCard の
   * `import { ${plugin.symbol} } from ...` がその形）。
   */
  readonly hasInterpolation: boolean;
}

const DECLARATION = /^const ([A-Za-z_$][A-Za-z0-9_$]*) = `/gm;

/** `${` の内側を読み飛ばす。入れ子の波括弧とテンプレート文字列を数える。 */
function skipInterpolation(text: string, openBraceIndex: number): number {
  let depth = 0;
  let index = openBraceIndex;
  while (index < text.length) {
    const character = text[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "`") {
      index = skipTemplateLiteral(text, index);
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
    index += 1;
  }
  return text.length;
}

/** 開き backtick の位置を受け、閉じ backtick の次の位置を返す。 */
function skipTemplateLiteral(text: string, openIndex: number): number {
  let index = openIndex + 1;
  while (index < text.length) {
    const character = text[index];
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "`") return index + 1;
    if (character === "$" && text[index + 1] === "{") {
      index = skipInterpolation(text, index + 1);
      continue;
    }
    index += 1;
  }
  return text.length;
}

const SINGLE_CHARACTER_ESCAPES: Readonly<Record<string, string>> = {
  n: "\n",
  r: "\r",
  t: "\t",
  b: "\b",
  f: "\f",
  v: "\v",
  "0": "\0",
};

/**
 * ソースに書かれた `\`` や `\$` を、実行時に得られる文字へ戻す。
 * これをしないと、抽出したコードに backslash がそのまま残り、型検査が
 * 「Invalid character」で落ちる（コード例の中身とは無関係な失敗になる）。
 * 未知のエスケープが文字そのものになるのは JavaScript の規則に合わせている。
 */
export function unescapeTemplateLiteral(source: string): string {
  let unescaped = "";
  let index = 0;
  while (index < source.length) {
    const character = source[index] ?? "";
    if (character !== "\\") {
      unescaped += character;
      index += 1;
      continue;
    }
    const escaped = source[index + 1] ?? "";
    unescaped += SINGLE_CHARACTER_ESCAPES[escaped] ?? escaped;
    index += 2;
  }
  return unescaped;
}

/** エスケープを飛ばしながら、生の `${` が在るかだけを見る。 */
export function hasUnescapedInterpolation(rawBody: string): boolean {
  let index = 0;
  while (index < rawBody.length) {
    if (rawBody[index] === "\\") {
      index += 2;
      continue;
    }
    if (rawBody[index] === "$" && rawBody[index + 1] === "{") return true;
    index += 1;
  }
  return false;
}

function countLinesBefore(text: string, index: number): number {
  let lines = 1;
  for (let position = 0; position < index; position += 1) {
    if (text[position] === "\n") lines += 1;
  }
  return lines;
}

/**
 * 行頭の `const NAME = ` + backtick をすべて拾う。行頭に限るのは、
 * フロントマター直下の宣言だけを対象にしたいためで、関数の内側に
 * インデントして書かれたものは（今のところ存在しないが）拾わない。
 */
export function findTemplateLiteralConstants(
  text: string
): readonly TemplateLiteralConstant[] {
  const found: TemplateLiteralConstant[] = [];
  DECLARATION.lastIndex = 0;
  let match = DECLARATION.exec(text);
  while (match !== null) {
    const name = match[1] ?? "";
    const openIndex = match.index + match[0].length - 1;
    const endIndex = skipTemplateLiteral(text, openIndex);
    const rawBody = text.slice(
      openIndex + 1,
      Math.max(openIndex + 1, endIndex - 1)
    );
    found.push({
      name,
      startLine: countLinesBefore(text, match.index),
      code: unescapeTemplateLiteral(rawBody),
      hasInterpolation: hasUnescapedInterpolation(rawBody),
    });
    DECLARATION.lastIndex = endIndex;
    match = DECLARATION.exec(text);
  }
  return found;
}
