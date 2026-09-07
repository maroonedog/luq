// ===========================================================================
// L7  src/plugins/string-exact-length/string-exact-length.ts
// `.exactLength(n)` on the string slot. UTF-16 `.length`, like its siblings.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isNumber, isString } from "../../types";

/** The members `.exactLength()` adds. Legacy name preserved. */
export interface StringExactLengthContext {
  readonly expected: number;
  readonly actual: number;
}

export const stringExactLengthPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [expected: number];
  out: Unchanged;
  context: StringExactLengthContext;
}>()({
  name: "stringExactLength",
  method: "exactLength",
  slots: ["string"] as const,
  build: (ctx, expected) => {
    if (!Number.isFinite(expected) || expected < 0) {
      throw new PluginArgumentError(ctx.pluginName, "expected", expected);
    }
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || value.length === expected
          ? PASS
          : fail({ expected, actual: value.length }),
      describe: (detail) =>
        `String must have exactly ${String(expected)} characters, but got ` +
        `${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        expected,
        actual: isNumber(detail.actual) ? detail.actual : 0,
      }),
    });
  },
});
