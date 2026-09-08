// ===========================================================================
// L10 src/standard-schema/split-issue-path.ts
//
// Luq の issue path ("items[1].productId") を Standard Schema の path
// (["items", 1, "productId"]) に開く。
//
// 方向に注意: これは formatIssuePath の逆で、宣言パス (parseFieldPath が
// 読む "items[*].productId") のパーサではない。issue path には [*] が
// 決して現れず、代わりに実インデックスが入る。二つの文法を一つの関数で
// 扱おうとすると、[*] を 0 と読むような取り違えが静かに入るので分けてある。
//
// 配列インデックスは number として出す。仕様の PropertyKey は
// string | number | symbol を許し、消費側 (フォームライブラリ) は
// 添字を number として受け取る前提で書かれているため。
// ===========================================================================

/** 開いた結果。オブジェクトのキーは string、配列の添字は number。 */
export type IssuePathSegments = readonly (string | number)[];

const INDEX_PATTERN = /^\[(\d+)\]/;

/**
 * ルート ("") は空配列。空配列は仕様上「ルート自身への issue」を意味する。
 *
 * 解釈できない形が来たら、握り潰さずに path 全体を1つの文字列セグメントとして
 * 返す。issue を落とすより、開けなかったことが分かる形で渡すほうがまし。
 */
export function splitIssuePath(path: string): IssuePathSegments {
  if (path === "") return [];

  const segments: (string | number)[] = [];
  let rest = path;
  let expectKey = true;

  while (rest !== "") {
    if (expectKey) {
      const key = rest.slice(0, findKeyEnd(rest));
      if (key === "") return [path];
      segments.push(key);
      rest = rest.slice(key.length);
      expectKey = false;
      continue;
    }
    const index = INDEX_PATTERN.exec(rest);
    if (index !== null) {
      segments.push(Number(index[1]));
      rest = rest.slice(index[0].length);
      continue;
    }
    if (rest.startsWith(".")) {
      rest = rest.slice(1);
      expectKey = true;
      continue;
    }
    return [path];
  }

  return expectKey ? [path] : segments;
}

/** キーは "." か "[" の手前まで。どちらも無ければ末尾まで。 */
function findKeyEnd(rest: string): number {
  const dot = rest.indexOf(".");
  const bracket = rest.indexOf("[");
  if (dot === -1) return bracket === -1 ? rest.length : bracket;
  if (bracket === -1) return dot;
  return Math.min(dot, bracket);
}
