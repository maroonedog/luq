// ===========================================================================
// src/core/type-erasure.ts — THE ONLY FILE PERMITTED TO ASSERT A TYPE.
// The code standard names this file by hand; everything else in src/ must reach
// a type by writing it, by a `unknown` + type-guard pair, or by a discriminated
// union. One function, one reason, so a reviewer can audit the whole escape
// hatch in ten lines.
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
