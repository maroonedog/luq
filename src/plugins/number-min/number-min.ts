// ===========================================================================
// L7  src/plugins/number-min/number-min.ts
//
// Legacy semantics (docs/legacy-spec/plugin-catalog-core.md#numberMinPlugin):
// non-numbers PASS, the bound is INCLUSIVE by default, and `exclusive` turns
// `>=` into `>`. That flag is how JSON Schema exclusiveMinimum is expressed, so
// it must stay marker-free plain data for the Draft-07 keyword table to bind
// it. Legacy carried it inside the trailing options bag; the frozen chain
// contract fixes that bag to RuleOptions, so it is a DECLARED positional
// argument here instead (see the type fixture for the call shape).
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isNumber } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";

export interface NumberMinContext {
  readonly min: number;
  readonly actual: number;
  readonly exclusive: boolean;
}

export const numberMinPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [min: number, exclusive?: boolean];
  out: Unchanged;
  context: NumberMinContext;
}>()({
  name: "numberMin",
  method: "min",
  slots: ["number"] as const,
  build: (ctx, min, exclusive) => {
    if (!isNumber(min) || Number.isNaN(min)) {
      throw new PluginArgumentError(ctx.pluginName, "min", min);
    }
    const isExclusive = exclusive === true;
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) => {
        if (!isNumber(value)) return PASS;
        const satisfied = isExclusive ? value > min : value >= min;
        return satisfied ? PASS : fail({ expected: min, actual: value });
      },
      describe: (detail) =>
        isExclusive
          ? `Value must be greater than ${String(min)}, but got ${String(detail.actual)}`
          : `Value must be at least ${String(min)}, but got ${String(detail.actual)}`,
      // describe/buildMessageContext run only after `run` failed, and `run`
      // only fails for a number, so the guard below is never the taken branch.
      buildMessageContext: (detail) => ({
        min,
        actual: isNumber(detail.actual) ? detail.actual : Number.NaN,
        exclusive: isExclusive,
      }),
    });
  },
});
