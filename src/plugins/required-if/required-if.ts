// ===========================================================================
// L7  src/plugins/required-if/required-if.ts
//
// The RootPredicate marker gives the call site legacy's exact condition
// signature `(allValues, arrayContext?) => boolean`. Legacy DECLARED that
// second parameter and never passed it; here it is RuleContext.item, which the
// array runner fills in, so a per-element condition on `items[*].x` actually
// receives { index, item, array }.
//
// This is a CONDITIONAL PRESENCE rule, not a check. A check is only ever
// reached for a value that already passed the field's presence gate, so as a
// check `.requiredIf(cond)` could reject "" and nothing else — a missing field
// went through in silence, which is the one case the plugin exists for.
// As a presence rule it decides the gate itself.
//
// Emptiness is legacy's: undefined, null or "".
// ===========================================================================
import type { TypeName } from "../../types";
import {
  REQUIRES_A_VALUE,
  conditionalPresence,
} from "../../plugin-kit/create-conditional-presence";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { RootPredicate, Unchanged } from "../../plugin-kit/marker.types";

/** Legacy RequiredIfContext: the condition that made the field required. */
export interface RequiredIfExtra {
  readonly condition: boolean;
}

const REQUIRED_IF_SLOTS: readonly TypeName[] = [
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

export const requiredIfPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [when: RootPredicate];
  out: Unchanged;
  context: RequiredIfExtra;
}>()({
  name: "requiredIf",
  method: "requiredIf",
  slots: REQUIRED_IF_SLOTS,
  build: (ctx, when) =>
    conditionalPresence({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      when,
      // Condition met: undefined, null and "" are all refused.
      whenMet: REQUIRES_A_VALUE,
      // Condition unmet: no opinion whatsoever, so a `.required()` or
      // `.optional()` declared on the same field still governs.
      whenUnmet: null,
      describe: () => "Field is required when condition is met",
      buildMessageContext: () => ({ condition: true }),
    }),
});
