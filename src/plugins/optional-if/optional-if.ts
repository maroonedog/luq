// ===========================================================================
// L7  src/plugins/optional-if/optional-if.ts — the logical dual of requiredIf.
//
// Condition true  + absent value -> accepted, and the rest of the field's
//                                   rules are skipped, as with `.optional()`.
// Condition false + absent value -> rejected (the field is effectively
//                                   required), undefined and null included.
// A present value is always accepted here.
//
// Both sides have an opinion, which is why this plugin overrules a plain
// `.required()` on the same field while its condition holds: that is what
// "optional if" means.
//
// Legacy hard-coded both its error code and its message and never invoked the
// messageFactory the signature advertised; 11 of its own tests failed because
// of it. Here `ctx.code` / `ctx.messageFactory` are the same ones every other
// plugin uses, so options.code and options.messageFactory work.
// ===========================================================================
import type { TypeName } from "../../types";
import {
  PERMITS_ABSENCE,
  REQUIRES_A_VALUE,
  conditionalPresence,
} from "../../plugin-kit/create-conditional-presence";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { RootPredicate, Unchanged } from "../../plugin-kit/marker.types";

/** Legacy OptionalIfContext: the condition that made the field optional. */
export interface OptionalIfExtra {
  readonly condition: boolean;
}

const OPTIONAL_IF_SLOTS: readonly TypeName[] = [
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

export const optionalIfPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [when: RootPredicate];
  out: Unchanged;
  context: OptionalIfExtra;
}>()({
  name: "optionalIf",
  method: "optionalIf",
  slots: OPTIONAL_IF_SLOTS,
  build: (ctx, when) =>
    conditionalPresence({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      when,
      whenMet: PERMITS_ABSENCE,
      whenUnmet: REQUIRES_A_VALUE,
      describe: () => "Field is optional when condition is met",
      buildMessageContext: () => ({ condition: false }),
    }),
});
