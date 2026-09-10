// ===========================================================================
// L6  src/builder/field-declared-calls.types.ts
//
// build() が計画と一緒に持ち帰る、パスごとの宣言。
//
// 計画 (L4 の ValidationPlan) には通していない。計画は実行時が読むものであり、
// 実行時はこの列を一度も読まない。通せば、書き出しを使わない利用者にも
// 計画を太らせる費用を払わせることになる。
// ===========================================================================
import type { DeclaredCall } from "../chain/declared-call.types";

export interface FieldDeclaredCalls {
  readonly path: string;
  /** null は「控えていない」。空配列の「宣言が無い」とは別。 */
  readonly calls: readonly DeclaredCall[] | null;
}
