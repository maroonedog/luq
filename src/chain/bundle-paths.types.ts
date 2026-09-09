// ===========================================================================
// L3  src/chain/bundle-paths.types.ts — 別名からルートのパスへの対応表と、
// そこから組み上がる束の型。
//
// なぜ別名を経由するのか。束をパス文字列そのものでキーすると、その文字列は
// 宣言の場で **パスとして** 解釈される: `.v("user.name")` は束の中の
// `user.name` を探しに行き、束は平たいので見つからない (実測済み)。
// 別名は素の識別子なので、その衝突が起きない。
//
// 副次的に、参照できるのは宣言した別名だけになる — 対応表が飾りではなく
// 強制になる、ということでもある。
// ===========================================================================
import type { FieldPath } from "../path/field-path.types";
import type { ValueAtPath } from "../path/value-at-path.types";
import type { AnyChain } from "./field-chain.types";
import type { FieldSlots } from "./field-slots.types";
import type { PluginBag } from "./plugin-bag.types";

/** 別名 -> ルートのパス。パスはルートに実在するものしか書けない。 */
export type BundlePaths<TRoot> = Readonly<
  Record<string, FieldPath<TRoot> & string>
>;

/** 対応表から組み上がる束。別名がキーで、値はそのパスの値。 */
export type BundleOf<TRoot, M extends BundlePaths<TRoot>> = {
  readonly [A in keyof M & string]: ValueAtPath<TRoot, M[A]>;
};

/**
 * 束ひとつに対するサブチェーン。
 *
 * stitch の核は「複数のフィールドを **1つの判定** にまとめる」ことなので、
 * 主体は束そのものであって別名ごとではない。別名ごとにルールを並べる形も
 * 書けるが、それは `total === price * quantity` のような判定が書けず、
 * stitch ではなくなる。
 *
 * 主体が束なので、束の中を `.v()` 的に見るのではなく、`b.object` などの
 * スロットがそのまま開く。型は BundleOf なので、束のメンバーは補完も効くし
 * 取り違えればコンパイルエラーになる — stitch が
 * `Readonly<Record<string, unknown>>` を渡していたのに対する、ここの一点だけ
 * が違いである。
 */
export type BundleChain<
  TRoot,
  M extends BundlePaths<TRoot>,
  B extends PluginBag,
> = (b: FieldSlots<BundleOf<TRoot, M>, B, BundleOf<TRoot, M>>) => AnyChain;
