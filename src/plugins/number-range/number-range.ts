// ===========================================================================
// L7  src/plugins/number-range/number-range.ts
//
// Inclusive on both ends: min <= value <= max. Non-numbers PASS.
//
// LEGACY BUG NOT CARRIED OVER (docs/legacy-spec/plugin-catalog-core.md
// #numberRangePlugin): the 1.x plugin did NOT reject bad parameters at build
// time. Instead its check returned FALSE for every value and the message became
// "Plugin configuration error: min (5) cannot be greater than max (1)" — a
// developer mistake reported to the END USER, once per validated value, forever.
// Here a misconfigured range is a PluginArgumentError thrown while the schema is
// being built, which is what every other bounded plugin already does.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isNumber } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";

export interface NumberRangeContext {
  readonly min: number;
  readonly max: number;
  readonly actual: number;
}

function isUsableBound(bound: number): boolean {
  return isNumber(bound) && !Number.isNaN(bound);
}

export const numberRangePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [min: number, max: number];
  out: Unchanged;
  context: NumberRangeContext;
}>()({
  name: "numberRange",
  method: "range",
  slots: ["number"] as const,
  build: (ctx, min, max) => {
    if (!isUsableBound(min)) {
      throw new PluginArgumentError(ctx.pluginName, "min", min);
    }
    if (!isUsableBound(max)) {
      throw new PluginArgumentError(ctx.pluginName, "max", max);
    }
    if (min > max) {
      throw new PluginArgumentError(ctx.pluginName, "max", max);
    }
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isNumber(value) || (value >= min && value <= max)
          ? PASS
          : fail({ expected: `${String(min)}..${String(max)}`, actual: value }),
      describe: (detail) =>
        `Value must be between ${String(min)} and ${String(max)}, but got ${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        min,
        max,
        actual: isNumber(detail.actual) ? detail.actual : Number.NaN,
      }),
    });
  },
});
