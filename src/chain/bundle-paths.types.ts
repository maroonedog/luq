// ===========================================================================
// L3  src/chain/bundle-paths.types.ts — the alias-to-path table, and the type
// of the bundle assembled from it.
//
// Why aliases rather than paths as keys. A path string used as a bundle key is
// interpreted AS A PATH where it is declared, so `"user.name"` goes looking
// for `user.name` inside the bundle and never finds it, the bundle being
// flat. An alias is a bare identifier, so that collision cannot happen.
//
// It follows that only declared aliases can be referred to, which makes the
// table binding rather than decorative.
// ===========================================================================
import type { FieldPath } from "../path/field-path.types";
import type { ValueAtPath } from "../path/value-at-path.types";
import type { AnyChain } from "./field-chain.types";
import type { FieldSlots } from "./field-slots.types";
import type { PluginBag } from "./plugin-bag.types";

/** Alias to a path from the root; only paths that exist there are writable. */
export type BundlePaths<TRoot> = Readonly<
  Record<string, FieldPath<TRoot> & string>
>;

/** The bundle built from the table: aliases as keys, the path's value as value. */
export type BundleOf<TRoot, M extends BundlePaths<TRoot>> = {
  readonly [A in keyof M & string]: ValueAtPath<TRoot, M[A]>;
};

/**
 * The sub-chain for one bundle.
 *
 * The subject is the bundle itself, not each alias: bringing several fields
 * into ONE judgement is the point, and a per-alias form cannot express
 * `total === price * quantity`.
 *
 * Because the subject is the bundle, the slots (`b.object` and friends) open
 * on it directly rather than descending into it. The bundle is typed, so its
 * members complete and mistaking one fails to compile.
 */
export type BundleChain<
  TRoot,
  M extends BundlePaths<TRoot>,
  B extends PluginBag,
> = (b: FieldSlots<BundleOf<TRoot, M>, B, BundleOf<TRoot, M>>) => AnyChain;
