// ===========================================================================
// L7  src/plugins/number-integer/number-integer.ts
//
// Number.isInteger, so 1.5, NaN, Infinity and -Infinity all fail. Non-numbers
// PASS. The default message is the legacy constant "Value must be an integer".
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import type { MessageContextExtra } from "../../types";
import { PASS, fail, isNumber } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";

export const numberIntegerPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "numberInteger",
  method: "integer",
  slots: ["number"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isNumber(value) || Number.isInteger(value)
          ? PASS
          : fail({ expected: "an integer", actual: value }),
      describe: () => "Value must be an integer",
      buildMessageContext: () => ({}),
    }),
});
