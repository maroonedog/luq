// ===========================================================================
// L7  src/plugins/number-finite/number-finite.ts
//
// Number.isFinite, so Infinity, -Infinity and NaN all fail. Non-numbers PASS.
// The default message is the legacy constant "Value must be a finite number".
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import type { MessageContextExtra } from "../../types";
import { PASS, fail, isNumber } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";

export const numberFinitePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "numberFinite",
  method: "finite",
  slots: ["number"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isNumber(value) || Number.isFinite(value)
          ? PASS
          : fail({ expected: "a finite number", actual: value }),
      describe: () => "Value must be a finite number",
      buildMessageContext: () => ({}),
    }),
});
