// ===========================================================================
// L7  src/plugins/or-fail/or-fail.ts — the negative gate.
//
// "If this condition holds, the field must not carry a value, whatever the
// value is." Deprecated fields, debug fields that must not reach production,
// fields a role or a feature flag forbids.
//
// Legacy took a raw `message` string option next to messageFactory. There is
// one message channel now — options.messageFactory — so a constant message is
// `{ messageFactory: () => "..." }` and there is no second precedence rule to
// remember.
// ===========================================================================
import {
  PASS,
  fail,
  type MessageContextExtra,
  type TypeName,
} from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { RootPredicate, Unchanged } from "../../plugin-kit/marker.types";

const OR_FAIL_SLOTS: readonly TypeName[] = [
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

export const orFailPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [when: RootPredicate];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "orFail",
  method: "orFail",
  slots: OR_FAIL_SLOTS,
  build: (ctx, when) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value, ruleContext) =>
        when(ruleContext.root, ruleContext.item)
          ? fail({ actual: value })
          : PASS,
      describe: () => "Validation failed",
      buildMessageContext: () => ({}),
    }),
});
