// ===========================================================================
// src/core/type-erasure.ts — THE ONLY FILE PERMITTED TO ASSERT A TYPE.
// The code standard names this file by hand; everything else in src/ must reach
// a type by writing it, by a `unknown` + type-guard pair, or by a discriminated
// union. Every function here carries its own reason, so a reviewer can audit
// the whole escape hatch in one file.
// ===========================================================================

/**
 * 理由: 動的にキーを積み上げて組み立てたレコードは、実行時にはキーが揃って
 * いても静的には Record<string, unknown> 止まりになる。呼び出し側のジェネリク
 * ス（AsyncContextBuilder.set の `C & { [P in K]: V }`）が、そのキーと値の対応
 * を型として保証している。
 */
export function eraseAssembledRecord<T extends object>(
  assembled: Readonly<Record<string, unknown>>
): T {
  return assembled as unknown as T;
}

/**
 * 理由: チェーンの実体は「バッグに入っているプラグインの数だけメソッドを生やした
 * レコード」で、実行時にはキーが揃っていても静的には Record<string, unknown> 止まり
 * になる。対応する型 FieldSlots / FieldChain は SlotPlugins によるマップ型なので、
 * 「どのキーが生えるか」は型引数 B と S からしか決まらず、値の組み立て側では書けない。
 * 正しさは attachSlotMethods が SlotPlugins と同じ規則（plugin.slots に S を含む
 * プラグインの plugin.method だけを生やす）で組み立てていることに依存する。
 */
export function eraseChainSurface<T extends object>(
  assembled: Readonly<Record<string, unknown>>
): T {
  return assembled as unknown as T;
}

/**
 * 理由: ビルダー連鎖の実体は「use で積んだプラグイン」「v で積んだ宣言」を持つ
 * 1 つのレコードで、実行時には段が進んでも同じ形のまま変わらない。一方その静的
 * な型は、段ごとの型引数（バッグの交差 B & BagEntry<P>、宣言済みパスの和
 * TDeclared | K、union guard の網羅で分岐する条件型）でしか書けず、組み立て側に
 * はその型を書く手段が無い。同じ理由で、L5 の createValidator はプランしか知らな
 * いので ValidationResult<unknown> しか返せず、宣言された T を戻せるのはこの
 * 境界だけである。
 * 正しさは、erased 側（src/builder/builder-surface.types.ts）が宣言型と同じ
 * メンバー集合を型として持ち、実装がそれに構造的に適合していることに依存する。
 * src/ 全体でこの関数の呼び出しは 1 箇所（src/builder/create-builder.ts）だけ。
 */
export function eraseBuilderSurface<T extends object>(assembled: object): T {
  return assembled as unknown as T;
}
