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
import { PASS, fail, isNumber, countCodePoints, isString } from "../../types";

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
      run: (value) =>
        !isString(value) || countCodePoints(value) >= min
          ? PASS
          : fail({ expected: min, actual: countCodePoints(value) }),
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
