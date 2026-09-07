// ===========================================================================
// L7  src/plugins/required-if/required-if.ts
//
// The RootPredicate marker gives the call site legacy's exact condition
// signature `(allValues, arrayContext?) => boolean`. Legacy DECLARED that
// second parameter and never passed it; here it is RuleContext.item, which the
// array runner fills in, so a per-element condition on `items[*].x` actually
// receives { index, item, array }.
//
// Emptiness is legacy's: undefined, null or "".
// ===========================================================================
import { PASS, fail, type TypeName } from "../../types";
import { check } from "../../plugin-kit/create-rule";
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

/** undefined, null and "" are absent; 0, false, [] and {} are present. */
function isEmptyForPresence(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

export const requiredIfPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [when: RootPredicate];
  out: Unchanged;
  context: RequiredIfExtra;
}>()({
  name: "requiredIf",
  method: "requiredIf",
  slots: REQUIRED_IF_SLOTS,
  build: (ctx, when) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value, ruleContext) => {
        if (!when(ruleContext.root, ruleContext.item)) return PASS;
        return isEmptyForPresence(value) ? fail({ actual: value }) : PASS;
      },
      describe: () => "Field is required when condition is met",
      buildMessageContext: () => ({ condition: true }),
    }),
});
