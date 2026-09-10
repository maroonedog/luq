// ===========================================================================
// L6  src/builder/declared-calls-store.ts
//
// build() が控えた宣言を、バリデータの外で持つ。
//
// Validator に生やさない理由は2つある。ひとつは公開インターフェースで、
// メンバーを増やすと to-standard-schema.ts が明示的に写している一覧も、
// 利用者が書いた実装も、同時に増やさなければならなくなる。もうひとつは
// 費用で、書き出しを使わない利用者にメンバー1つ分を払わせることになる。
//
// 連鎖ノードが同じ手を使っている (chain/chain-node-store.ts)。同じ理由である。
// ===========================================================================
import type { FieldDeclaredCalls } from "./field-declared-calls.types";

const declaredCallsByValidator = new WeakMap<
  object,
  readonly FieldDeclaredCalls[]
>();

/** build() だけが呼ぶ。凍結済みのバリデータに後から結び付ける。 */
export function rememberDeclaredCalls(
  validator: object,
  calls: readonly FieldDeclaredCalls[]
): void {
  declaredCallsByValidator.set(validator, calls);
}

/**
 * undefined は「このバリデータは build() が作ったものではない」を意味する。
 * 空配列と区別できる形で返すのが肝で、書き出す側はこの差で
 * 「制約が無い」と「宣言を持っていない」を言い分けられる。
 */
export function readDeclaredCalls(
  validator: unknown
): readonly FieldDeclaredCalls[] | undefined {
  if (typeof validator !== "object" || validator === null) return undefined;
  return declaredCallsByValidator.get(validator);
}
