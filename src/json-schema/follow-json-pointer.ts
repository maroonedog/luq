// ===========================================================================
// L8  src/json-schema/follow-json-pointer.ts — RFC 6901 のポインタを辿る。
//
// `$ref` のうち **場所** を表す部分だけを担う。どの文書を見るかは
// schema-registry.ts と resolve-ref.ts の仕事で、ここは「その文書の中の
// どこか」だけを答える。分けてあるのは、`$id` によるベース URI の話と
// ポインタの復号の話が別物であり、混ぜると 200 行を超えて両方読みにくく
// なるからである。
// ===========================================================================
import { isArray, isPlainObject } from "../types";

/** RFC 6901: `~1` is "/" and `~0` is "~", decoded in that order. */
function decodePointerToken(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

/**
 * `$ref` は URI で、ポインタはそのフラグメント。RFC 6901 §6 は
 * 「フラグメントの規則でパーセント符号化されている」と定めるので、
 * **スラッシュで割る前にフラグメント全体を復号する**。
 *
 * 順序が意味を持つ。`#/definitions/percent%25field` は復号して
 * `/definitions/percent%field` になり、そこで割ってトークンを得る。
 * 先に割ってからトークンごとに復号すると `%25` は復号されるが、
 * `%2F` が「区切りとしてのスラッシュ」に戻る仕様どおりの挙動にならない。
 *
 * 壊れたパーセント列 (`%zz`) は decodeURIComponent が投げるので、
 * 復号できないポインタはそのまま扱う。ここで投げると、ポインタが1つ
 * 壊れているだけで文書全体が読めなくなる。
 */
function decodeFragment(pointer: string): string {
  try {
    return decodeURIComponent(pointer);
  } catch {
    return pointer;
  }
}

/** `fragment` is what came AFTER the "#", so there is no prefix to strip. */
export function toPointerTokens(fragment: string): readonly string[] {
  const pointer = decodeFragment(fragment);
  if (pointer === "") return [];
  // "/" は「ルート直下の空文字キー」であって空のトークン列ではない。
  // ここを [] にすると `{"": ...}` を指すポインタがルートに化ける。
  return pointer.split("/").slice(1).map(decodePointerToken);
}

/**
 * `definitions` and `$defs` are the same container to a pointer: a Draft-07
 * document spells it one way, a 2019-09 document the other, and a schema that
 * mixes them (they exist) must still resolve. A real `definitions` member
 * always wins, so a property literally named "definitions" is unaffected.
 */
export function stepInto(current: unknown, token: string): unknown {
  if (isArray(current)) return current[Number(token)];
  if (!isPlainObject(current)) return undefined;
  if (token === "definitions" || token === "$defs") {
    return current["definitions"] ?? current["$defs"];
  }
  return current[token];
}

/**
 * ポインタを辿りながら、**途中で跨いだ `$id` を数える**。
 *
 * `#/definitions/baz/definitions/bar` の `baz` が `$id: "folder/"` を持つとき、
 * `bar` の中に書かれた相対 `$ref` は folder/ の下で解決されなければならない。
 * 着地したノードの `$id` だけを見ると、通過したノードの分が落ちる。
 *
 * ベースをどう進めるかは呼び出し側が渡す (`advance`)。この関数は「どのノードを
 * どの順に跨いだか」だけを知っていればよく、URI の演算は持たない。
 */
export function walkPointer<TScope>(
  fragment: string,
  document: unknown,
  scope: TScope,
  advance: (scope: TScope, node: unknown) => TScope,
  onMissing: (token: string) => never
): { readonly node: unknown; readonly scope: TScope } {
  let current: unknown = document;
  let here = scope;
  for (const token of toPointerTokens(fragment)) {
    current = stepInto(current, token);
    if (current === undefined) onMissing(token);
    here = advance(here, current);
  }
  return { node: current, scope: here };
}
