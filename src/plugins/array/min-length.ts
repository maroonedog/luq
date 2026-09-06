// ===========================================================================
// L7  src/plugins/array/min-length.ts
// Marker-free by design: every argument is plain data, so IsMarkerFree<args>
// is true and the Draft-07 keyword table can bind to it. The method name is
// the legacy public surface (docs/legacy-public-surface.md): arrayMinLength's
// method really is `minLength`, NOT `minItems`. The keyword table is where
// `minItems -> minLength` is written down, and that binding is type-checked,
// so the legacy silent duck-typing cannot come back.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isArray, isNumber } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";

export const arrayMinLengthPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [min: number];
  out: Unchanged;
  context: { min: number; actual: number };
}>()({
  name: "arrayMinLength",
  method: "minLength",
  slots: ["array", "tuple"] as const,
  build: (ctx, min) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isArray(value) || value.length >= min
          ? PASS
          : fail({ expected: min, actual: value.length }),
      describe: (detail) =>
        `Array must have at least ${String(detail.expected)} items`,
      buildMessageContext: (detail) => ({
        min,
        actual: isNumber(detail.actual) ? detail.actual : 0,
      }),
    }),
});
