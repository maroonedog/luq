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
