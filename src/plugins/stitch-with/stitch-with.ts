// ===========================================================================
// L7  src/plugins/stitch-with/stitch-with.ts — EXPERIMENTAL.
// The typed successor to `stitch`, for cross-field validation.
//
// The point of stitching is to bring SEVERAL FIELDS INTO ONE JUDGEMENT, so
// the subject is the bundle itself and not each alias. Listing rules per alias
// is writable but cannot express `total === price * quantity`, at which point
// it is no longer stitching.
//
// One difference from `stitch`. There the bundle reaches the predicate as
// `Readonly<Record<string, unknown>>`, so the type says nothing about its
// contents. Here the bundle is assembled from a mapping and IS TYPED:
//
//     .v("total", (b) => b.number.stitchWith(
//       { cost: "price", count: "quantity" },
//       (f) => f.object.custom((bundle) => bundle.cost * bundle.count === 100)
//     ))
//
// `bundle` is `{ cost: number; count: number }`, not a Record. Misspell a
// member or mistake its type and it fails to compile.
//
// Why aliases rather than paths as keys. A path string used as a bundle key is
// interpreted AS A PATH where it is declared, so `"user.name"` goes looking
// for `user.name` inside the bundle and never finds it, the bundle being
// flat. An alias is a bare identifier, so that collision cannot happen and the
// only things referable are the aliases actually declared.
//
// No judgement happens in this file. The sub-chain resolves to
// `readonly Rule[]` through the same route a narrowed chain takes, and the
// engine runs it. A bundle-specific collector in the core was built and
// measured; it added bytes to everyone who never stitches, so this rides the
// existing route instead and adds none.
// ===========================================================================
import { PASS, fail, isPlainObject } from "../../types";
import type { MessageContextExtra } from "../../types";
import { branch, composite } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import { createValueReader, parseFieldPath } from "../../path/index";
import type { ValueReader } from "../../path/index";
import type { BundleOut, NarrowedChain } from "../../plugin-kit/marker.types";

/** Alias to a path from the root. At run time, a table of strings. */
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

/** Assembles the bundle from the root; this object is the branch's subject. */
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
  out: BundleOut;
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
      // The field's own value is not read. Only the assembled bundle is.
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
