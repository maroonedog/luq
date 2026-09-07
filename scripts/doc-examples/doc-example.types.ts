/**
 * ドキュメント中のコード例1つ分。`file` はリポジトリ相対の posix パス、
 * `startLine` は開きフェンスの行番号 (1 始まり) なので、違反はエディタから
 * そのまま開ける。
 */
export interface DocExample {
  readonly file: string;
  readonly startLine: number;
  readonly language: string;
  readonly expectation: DocExampleExpectation;
  readonly reason: string;
  readonly code: string;
  /**
   * `code` の先頭に足された前置きの行数。docs-site の抜粋は、ページ上では
   * 直前のブロックが宣言した validator を使うだけの短い形で見せたまま、
   * 型検査には前置きを付けた完全な形を渡す（read-astro-examples.ts の
   * `with` ディレクティブ）。診断の行番号をドキュメント上の行に戻すために
   * この分を引く。Markdown のコード例では常に 0。
   */
  readonly preludeLineCount?: number;
}

/**
 * 既定は `compiles`。`must-fail` は「1.x の書き方はもうコンパイルできない」を
 * 主張する移行ガイド用で、通ってしまったらそれ自体が違反になる。
 * `skip` は断片 (import を伴わない鎖の一部など) 専用で、理由を必ず書かせる。
 */
export type DocExampleExpectation = "compiles" | "must-fail" | "skip";

export type DocExampleViolationKind =
  | "didNotCompile"
  | "compiledButMustFail"
  | "directiveWithoutReason"
  | "unknownDirective"
  | "unpublishedImport"
  | "brokenLink";

export interface DocExampleViolation {
  readonly file: string;
  readonly startLine: number;
  readonly kind: DocExampleViolationKind;
  readonly detail: string;
}
