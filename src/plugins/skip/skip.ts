// ===========================================================================
// L7  src/plugins/skip/skip.ts — "do not validate when".
//
// The polarity-inverted twin of validateIf, kept as its own plugin because
// legacy-spec records `./plugins/skip` as a published subpath and users read
// the two names as opposites. The only difference is the `!`.
//
// Legacy ignored its options object entirely; here options.code names the gate
// exactly as it names every other rule.
// ===========================================================================
import type { MessageContextExtra, TypeName } from "../../types";
import { gate } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { RootPredicate, Unchanged } from "../../plugin-kit/marker.types";

const SKIP_SLOTS: readonly TypeName[] = [
  "string",
  "number",
  "boolean",
  "date",
  "array",
  "tuple",
  "object",
  "union",
  "any",
];

export const skipPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [when: RootPredicate];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "skip",
  method: "skip",
  slots: SKIP_SLOTS,
  build: (ctx, when) =>
    gate(
      ctx.code,
      (_value, ruleContext) => !when(ruleContext.root, ruleContext.item)
    ),
});
