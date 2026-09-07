// ===========================================================================
// L7  src/plugins/validate-if/validate-if.ts — "only validate when".
//
// A GateRule, so the engine, not the plugin, decides what a closed gate means:
// runField collects every gate the field declared and asks all of them BEFORE
// it runs any check or transform. Legacy instead broke out of a validator loop
// the moment `shouldSkipAllValidation` returned true, which made the answer
// depend on WHERE in the chain the call sat — `.min(3).validateIf(c)` still ran
// min(3). Here the position in the chain is irrelevant.
//
// A gate never reports: legacy's getErrorMessage threw `new Error(...)` to say
// "unreachable". GateRule simply has no message to write.
// ===========================================================================
import type { MessageContextExtra, TypeName } from "../../types";
import { gate } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { RootPredicate, Unchanged } from "../../plugin-kit/marker.types";

const VALIDATE_IF_SLOTS: readonly TypeName[] = [
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

export const validateIfPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [when: RootPredicate];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "validateIf",
  method: "validateIf",
  slots: VALIDATE_IF_SLOTS,
  build: (ctx, when) =>
    gate(ctx.code, (_value, ruleContext) =>
      when(ruleContext.root, ruleContext.item)
    ),
});
