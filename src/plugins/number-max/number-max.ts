// ===========================================================================
// L7  src/plugins/number-max/number-max.ts
//
// The mirror of number-min: non-numbers PASS, the bound is INCLUSIVE by
// default, and `exclusive` turns `<=` into `<` — the way JSON Schema
// exclusiveMaximum is expressed. Marker-free, so the Draft-07 keyword table
// can bind `maximum` and `exclusiveMaximum` to the same method.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isNumber } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";

export interface NumberMaxContext {
  readonly max: number;
  readonly actual: number;
  readonly exclusive: boolean;
}

export const numberMaxPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [max: number, exclusive?: boolean];
  out: Unchanged;
  context: NumberMaxContext;
}>()({
  name: "numberMax",
  method: "max",
  slots: ["number"] as const,
  build: (ctx, max, exclusive) => {
    if (!isNumber(max) || Number.isNaN(max)) {
      throw new PluginArgumentError(ctx.pluginName, "max", max);
    }
    const isExclusive = exclusive === true;
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) => {
        if (!isNumber(value)) return PASS;
        const satisfied = isExclusive ? value < max : value <= max;
        return satisfied ? PASS : fail({ expected: max, actual: value });
      },
      describe: (detail) =>
        isExclusive
          ? `Value must be less than ${String(max)}, but got ${String(detail.actual)}`
          : `Value must be at most ${String(max)}, but got ${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        max,
        actual: isNumber(detail.actual) ? detail.actual : Number.NaN,
        exclusive: isExclusive,
      }),
    });
  },
});
