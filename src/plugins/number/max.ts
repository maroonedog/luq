// ===========================================================================
// L7  src/plugins/number/max.ts
// Marker-free by design: every argument is plain data, so IsMarkerFree<args>
// is true and the Draft-07 keyword table can bind to it. The method name is
// the legacy public surface (docs/legacy-public-surface.md): arrayMinLength's
// method really is `minLength`, NOT `minItems`. The keyword table is where
// `minItems -> minLength` is written down, and that binding is type-checked,
// so the legacy silent duck-typing cannot come back.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isNumber } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";

export const numberMaxPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [max: number];
  out: Unchanged;
  context: { max: number };
}>()({
  name: "numberMax",
  method: "max",
  slots: ["number"] as const,
  build: (ctx, max) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isNumber(value) || value <= max
          ? PASS
          : fail({ expected: max, actual: value }),
      describe: (detail) => `Number must be at most ${String(detail.expected)}`,
      buildMessageContext: () => ({ max }),
    }),
});
