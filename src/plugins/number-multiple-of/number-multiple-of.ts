// ===========================================================================
// L7  src/plugins/number-multiple-of/number-multiple-of.ts
//
// Non-numbers PASS; a number must be an exact multiple of `divisor`. The
// float-modulo bug that made .multipleOf(0.1) reject 0.3 is fixed in
// is-multiple-of.ts, which this file delegates the arithmetic to.
//
// Legacy threw `Invalid divisor: ${divisor}. Must be a non-zero number.` for a
// non-number or 0 divisor. NaN and Infinity slipped through and turned every
// value into a failure; here they are PluginArgumentError at build time too.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isNumber } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";
import { isMultipleOf } from "./is-multiple-of";

export interface NumberMultipleOfContext {
  readonly divisor: number;
}

export const numberMultipleOfPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [divisor: number];
  out: Unchanged;
  context: NumberMultipleOfContext;
}>()({
  name: "numberMultipleOf",
  method: "multipleOf",
  slots: ["number"] as const,
  build: (ctx, divisor) => {
    if (!isNumber(divisor) || !Number.isFinite(divisor) || divisor === 0) {
      throw new PluginArgumentError(ctx.pluginName, "divisor", divisor);
    }
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isNumber(value) || isMultipleOf(value, divisor)
          ? PASS
          : fail({ expected: divisor, actual: value }),
      describe: () => `Value must be a multiple of ${String(divisor)}`,
      buildMessageContext: () => ({ divisor }),
    });
  },
});
