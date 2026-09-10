// ===========================================================================
// L7  src/plugins/string-min/string-min.ts
// `.min(n)` on the string slot. Length is UTF-16 `.length`, so an astral
// character counts as 2 — the legacy behaviour, now stated instead of implied.
// A wrong-typed value PASSES: the slot guard owns type and the presence
// modifiers own null/undefined, so a value rule never re-decides either.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isNumber, isString } from "../../types";

/** The members `.min()` adds to the message context. Legacy name preserved. */
export interface StringMinContext {
  readonly min: number;
  readonly actual: number;
}

export const stringMinPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [min: number];
  out: Unchanged;
  context: StringMinContext;
}>()({
  name: "stringMin",
  method: "min",
  slots: ["string"] as const,
  build: (ctx, min) => {
    if (!Number.isFinite(min) || min < 0) {
      throw new PluginArgumentError(ctx.pluginName, "min", min);
    }
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      // Stops as soon as min is reached. The full length is only needed to
      // REPORT a failure, and a failing value is shorter than min, so that
      // walk is short too. Counting is still by code point, not UTF-16 unit;
      // the only thing that changed is when it stops.
      run: (value) => {
        if (!isString(value)) return PASS;
        // min of 0 admits the empty string. The loop body never runs on an
        // empty string, so without this line the empty string fails with 0.
        if (min === 0) return PASS;
        let count = 0;
        for (const _character of value) {
          count += 1;
          if (count >= min) return PASS;
        }
        return fail({ expected: min, actual: count });
      },
      describe: (detail) =>
        `String must have at least ${String(min)} characters, but got ` +
        `${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        min,
        actual: isNumber(detail.actual) ? detail.actual : 0,
      }),
    });
  },
});
