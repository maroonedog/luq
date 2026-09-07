// ===========================================================================
// L7  src/plugins/array-min-length/array-min-length.ts
//
// Legacy semantics (docs/legacy-spec/plugin-catalog-structural.md#arrayMinLengthPlugin):
// a non-array PASSES (the type slot's own guard owns type errors), an array
// must be at least `min` long, and the message context is {min, actual}.
//
// Marker-free by design: every argument is plain data, so IsMarkerFree<args>
// is true and the Draft-07 keyword table can bind to it. The method name is
// the legacy public surface (docs/legacy-public-surface.md): arrayMinLength's
// method really is `minLength`, NOT `minItems`. The keyword table is where
// `minItems -> minLength` is written down, and that binding is type-checked,
// so the legacy silent duck-typing cannot come back.
//
// LEGACY BUG FIXED: legacy threw on a negative bound but let NaN through, and
// the throw was swallowed whole by attachPluginMethods' try/catch, so the rule
// silently vanished from the field. The guard is now a build-time throw the
// caller actually receives.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isArray, isNumber } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";

export interface ArrayMinLengthContext {
  readonly min: number;
  readonly actual: number;
}

export const arrayMinLengthPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [min: number];
  out: Unchanged;
  context: ArrayMinLengthContext;
}>()({
  name: "arrayMinLength",
  method: "minLength",
  slots: ["array", "tuple"] as const,
  build: (ctx, min) => {
    if (!isNumber(min) || !Number.isFinite(min) || min < 0) {
      throw new PluginArgumentError(ctx.pluginName, "min", min);
    }
    return check<ArrayMinLengthContext>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isArray(value) || value.length >= min
          ? PASS
          : fail({ expected: min, actual: value.length }),
      describe: (detail) =>
        `Array must have at least ${String(min)} elements, but got ${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        min,
        actual: isNumber(detail.actual) ? detail.actual : 0,
      }),
    });
  },
});
