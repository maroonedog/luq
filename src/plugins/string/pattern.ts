// ===========================================================================
// L7  src/plugins/string/pattern.ts
// Marker-free by design: every argument is plain data, so IsMarkerFree<args>
// is true and the Draft-07 keyword table can bind to it. The method name is
// the legacy public surface (docs/legacy-public-surface.md): arrayMinLength's
// method really is `minLength`, NOT `minItems`. The keyword table is where
// `minItems -> minLength` is written down, and that binding is type-checked,
// so the legacy silent duck-typing cannot come back.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";

export const stringPatternPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [pattern: string];
  out: Unchanged;
  context: { pattern: string };
}>()({
  name: "stringPattern",
  method: "pattern",
  slots: ["string"] as const,
  build: (ctx, pattern) => {
    const expression = new RegExp(pattern);
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || expression.test(value)
          ? PASS
          : fail({ expected: pattern }),
      describe: () => `String must match ${pattern}`,
      buildMessageContext: () => ({ pattern }),
    });
  },
});

/**
 * The single home of `format`. The legacy code held THREE format tables that
 * disagreed (jsonSchema/format-validators.ts, the stringXxx plugins, and
 * error-generation.ts). Format names stay open strings so a custom format can
 * be registered; an unknown name passes, per the Draft-07 annotation default.
 */
export type FormatChecker = (value: string) => boolean;
