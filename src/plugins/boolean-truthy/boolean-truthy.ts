// ===========================================================================
// L7  src/plugins/boolean-truthy/boolean-truthy.ts
//
// Despite the legacy name this is an EXACT `=== true` check with no coercion,
// and non-booleans (null, undefined, a missing field) PASS. Both facts are
// carried over verbatim from 1.x, including the default message "Value must be
// truthy" that under-describes them; changing either would silently alter what
// existing schemas accept.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import type { MessageContextExtra } from "../../types";
import { PASS, fail } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export const booleanTruthyPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "booleanTruthy",
  method: "truthy",
  slots: ["boolean"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isBoolean(value) || value === true
          ? PASS
          : fail({ expected: true, actual: value }),
      describe: () => "Value must be truthy",
      buildMessageContext: () => ({}),
    }),
});
