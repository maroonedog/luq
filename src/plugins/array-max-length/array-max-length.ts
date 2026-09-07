// ===========================================================================
// L7  src/plugins/array-max-length/array-max-length.ts
//
// The mirror of arrayMinLength, and deliberately the SAME shape: a non-array
// passes, the bound is inclusive, the message context is {max, actual}
// (docs/legacy-spec/plugin-catalog-structural.md#arrayMaxLengthPlugin).
// Marker-free so the Draft-07 `maxItems` keyword can bind to it.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isArray, isNumber } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";

export interface ArrayMaxLengthContext {
  readonly max: number;
  readonly actual: number;
}

export const arrayMaxLengthPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [max: number];
  out: Unchanged;
  context: ArrayMaxLengthContext;
}>()({
  name: "arrayMaxLength",
  method: "maxLength",
  slots: ["array", "tuple"] as const,
  build: (ctx, max) => {
    if (!isNumber(max) || !Number.isFinite(max) || max < 0) {
      throw new PluginArgumentError(ctx.pluginName, "max", max);
    }
    return check<ArrayMaxLengthContext>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isArray(value) || value.length <= max
          ? PASS
          : fail({ expected: max, actual: value.length }),
      describe: (detail) =>
        `Array must have at most ${String(max)} elements, but got ${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        max,
        actual: isNumber(detail.actual) ? detail.actual : 0,
      }),
    });
  },
});
