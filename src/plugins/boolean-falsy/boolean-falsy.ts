// ===========================================================================
// L7  src/plugins/boolean-falsy/boolean-falsy.ts
//
// The mirror of boolean-truthy: an EXACT `=== false` check with no coercion,
// non-booleans PASS. Legacy's own runtime notes confirm null, undefined and a
// missing field all pass when only .falsy() is applied; that is preserved, as
// is the default message "Value must be falsy".
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import type { MessageContextExtra } from "../../types";
import { PASS, fail } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export const booleanFalsyPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "booleanFalsy",
  method: "falsy",
  slots: ["boolean"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isBoolean(value) || value === false
          ? PASS
          : fail({ expected: false, actual: value }),
      describe: () => "Value must be falsy",
      buildMessageContext: () => ({}),
    }),
});
