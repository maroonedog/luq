// ===========================================================================
// L7  src/plugins/value/one-of.ts — the legacy VALUE enum, meaning unchanged.
// `readonly SelfValue[]` types the list against the field: at the call site it
// is `readonly string[]` on a string chain, and `readonly unknown[]` in build().
// That also makes it correctly NON-bindable by bindKeyword, whose PluginArgs is
// the declared tuple: binding it as if declared == runtime would be wrong.
// ===========================================================================
import { PASS, fail, type MessageContextExtra } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { SelfValue, Unchanged } from "../../plugin-kit/marker.types";

export const oneOfPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [allowed: readonly SelfValue[]];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "oneOf",
  method: "oneOf",
  slots: ["string", "number", "boolean"] as const,
  build: (ctx, allowed) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        allowed.includes(value)
          ? PASS
          : fail({ expected: allowed, actual: value }),
      describe: (detail) =>
        `Value must be one of: ${JSON.stringify(detail.expected)}`,
      buildMessageContext: () => ({}),
    }),
});
