// ===========================================================================
// L7  src/plugins/optional-if/optional-if.ts — the logical dual of requiredIf.
//
// Condition true  + empty value -> accepted.
// Condition false + empty value -> rejected (the field is effectively required).
// A non-empty value is always accepted.
//
// Legacy hard-coded both its error code and its message and never invoked the
// messageFactory the signature advertised; 11 of its own tests failed because
// of it. Here `ctx.code` / `ctx.messageFactory` are the same ones every other
// plugin uses, so options.code and options.messageFactory work.
// ===========================================================================
import { PASS, fail, type TypeName } from "../../types";
import { check } from "../../plugin-kit/create-rule";
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

function isEmptyForPresence(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

export const optionalIfPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [when: RootPredicate];
  out: Unchanged;
  context: OptionalIfExtra;
}>()({
  name: "optionalIf",
  method: "optionalIf",
  slots: OPTIONAL_IF_SLOTS,
  build: (ctx, when) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value, ruleContext) => {
        if (!isEmptyForPresence(value)) return PASS;
        return when(ruleContext.root, ruleContext.item)
          ? PASS
          : fail({ actual: value });
      },
      describe: () => "Field is optional when condition is met",
      buildMessageContext: () => ({ condition: false }),
    }),
});
