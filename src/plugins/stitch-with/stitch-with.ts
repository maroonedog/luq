// ===========================================================================
// L7  src/plugins/stitch-with/stitch-with.ts — EXPERIMENTAL.
// `stitch` の型付き後継。クロスフィールド検証のためのメソッドである。
//
// stitch の核は「**複数のフィールドを1つの判定にまとめる**」ことなので、
// 主体は束そのものであって、別名ごとではない。別名ごとにルールを並べる形も
// 書けるが、それでは `total === price * quantity` が書けず、stitch では
// なくなる。
//
// stitch との違いは一点だけである。stitch は束を
// `Readonly<Record<string, unknown>>` として手書きの述語に渡すので、束の中身に
// ついて型が何も言わない。ここでは束が対応表から組まれて **型が付く**:
//
//     .v("total", (b) => b.number.stitchWith(
//       { cost: "price", count: "quantity" },
//       (f) => f.object.custom((bundle) => bundle.cost * bundle.count === 100)
//     ))
//
// `bundle` は `{ cost: number; count: number }` であって Record ではない。
// メンバー名を綴り違えれば、型を取り違えれば、コンパイルエラーになる。
//
// なぜ別名を経由するのか。束をパス文字列でキーすると、その文字列は宣言の場で
// **パスとして** 解釈される: `"user.name"` は束の中の `user.name` を探しに
// 行き、束は平たいので見つからない (実測して分かった)。別名は素の識別子なので
// その衝突が起きず、参照できるのは宣言した別名だけになる。
//
// このファイルに判定は無い。サブチェーンは NarrowedChain と同じ経路で
// `readonly Rule[]` に解決され、branch がそれを枝にし、エンジンが走らせる。
// 束専用の収集器をコアに置く案も作って動かしたが、実測でコアが 220 B 増えた
// (7,590 -> 7,810 B)。stitchWith を使わない利用者が払う形なので採らなかった。
// 既存の経路に乗せると追加は 0 B である。
//
// 1.x が同じ責務の実装を3つ持っていたのは、ここで「もう1つ書く」を選んだ
// からである。
// ===========================================================================
import { PASS, fail, isPlainObject } from "../../types";
import type { MessageContextExtra } from "../../types";
import { branch, composite } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import { createValueReader, parseFieldPath } from "../../path/index";
import type { ValueReader } from "../../path/index";
import type { NarrowedChain, StitchOut } from "../../plugin-kit/marker.types";

/** 別名 -> ルートのパス。実行時はただの文字列の対応表である。 */
export type BundleAliasMap = Readonly<Record<string, string>>;

export interface StitchWithExtra extends MessageContextExtra {
  readonly aliases: readonly string[];
}

interface BundleMember {
  readonly alias: string;
  readonly read: ValueReader;
}

const STITCH_WITH_SLOTS = [
  "string",
  "number",
  "boolean",
  "date",
  "object",
  "array",
  "tuple",
  "union",
] as const;

const BUNDLE_BRANCH_LABEL = "bundle";

function readMembers(aliasMap: BundleAliasMap): readonly BundleMember[] {
  return Object.freeze(
    Object.entries(aliasMap).map(([alias, path]) => ({
      alias,
      read: createValueReader(parseFieldPath(path)),
    }))
  );
}

/** ルートから束を組む。枝の主体はこのオブジェクトになる。 */
function collectBundle(
  members: readonly BundleMember[],
  root: unknown
): Readonly<Record<string, unknown>> {
  const bundle: Record<string, unknown> = {};
  for (const member of members) bundle[member.alias] = member.read(root);
  return bundle;
}

export const stitchWithPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [fields: BundleAliasMap, define: NarrowedChain];
  out: StitchOut;
  context: StitchWithExtra;
}>()({
  name: "stitchWith",
  method: "stitchWith",
  slots: STITCH_WITH_SLOTS,
  build: (ctx, aliasMap, rules) => {
    const members = readMembers(isPlainObject(aliasMap) ? aliasMap : {});
    const aliases = Object.freeze(members.map((member) => member.alias));
    return composite<StitchWithExtra>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches: [branch(BUNDLE_BRANCH_LABEL, rules)],
      // 主体の値は見ない。見るのはルートから組んだ束だけである。
      combine: (runners) => {
        const runner = runners[0];
        if (runner === undefined) return () => PASS;
        return (_value, runCtx) => {
          const outcome = runner.run(
            collectBundle(members, runCtx.root),
            runCtx
          );
          return outcome.ok ? PASS : fail({ ...outcome.detail });
        };
      },
      describe: (_detail, msgCtx) =>
        `Cross-field validation failed for ${msgCtx.path}`,
      buildMessageContext: () => ({ aliases }),
    });
  },
  subChainArguments: [1],
});
