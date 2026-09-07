// ===========================================================================
// L7  src/plugins/number-negative/number-negative.ts
//
// STRICTLY negative: `value < 0`, so 0 fails and -0 fails with it (`-0 < 0` is
// false). Non-numbers PASS. The default message is the legacy constant.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import type { MessageContextExtra } from "../../types";
import { PASS, fail, isNumber } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";

export const numberNegativePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "numberNegative",
  method: "negative",
  slots: ["number"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isNumber(value) || value < 0
          ? PASS
          : fail({ expected: "a negative number", actual: value }),
      describe: () => "Value must be negative",
      buildMessageContext: () => ({}),
    }),
});
