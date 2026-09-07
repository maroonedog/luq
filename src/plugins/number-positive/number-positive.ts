// ===========================================================================
// L7  src/plugins/number-positive/number-positive.ts
//
// STRICTLY positive: `value > 0`, so 0 fails and -0 fails with it (`-0 > 0` is
// false). Non-numbers PASS, which is what keeps this composable with optional
// and nullable. The default message is the legacy constant — no path, no value.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import type { MessageContextExtra } from "../../types";
import { PASS, fail, isNumber } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";

export const numberPositivePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "numberPositive",
  method: "positive",
  slots: ["number"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isNumber(value) || value > 0
          ? PASS
          : fail({ expected: "a positive number", actual: value }),
      describe: () => "Value must be positive",
      buildMessageContext: () => ({}),
    }),
});
