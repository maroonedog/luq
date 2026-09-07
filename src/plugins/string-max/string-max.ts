// ===========================================================================
// L7  src/plugins/string-max/string-max.ts
// `.max(n)` on the string slot. max: 0 permits only the empty string.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isNumber, isString } from "../../types";

/** The members `.max()` adds to the message context. Legacy name preserved. */
export interface StringMaxContext {
  readonly max: number;
  readonly actual: number;
}

export const stringMaxPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [max: number];
  out: Unchanged;
  context: StringMaxContext;
}>()({
  name: "stringMax",
  method: "max",
  slots: ["string"] as const,
  build: (ctx, max) => {
    if (!Number.isFinite(max) || max < 0) {
      throw new PluginArgumentError(ctx.pluginName, "max", max);
    }
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || value.length <= max
          ? PASS
          : fail({ expected: max, actual: value.length }),
      describe: (detail) =>
        `String must have at most ${String(max)} characters, but got ` +
        `${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        max,
        actual: isNumber(detail.actual) ? detail.actual : 0,
      }),
    });
  },
});
