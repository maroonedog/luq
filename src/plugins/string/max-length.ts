// ===========================================================================
// L7  src/plugins/string/max-length.ts
// Marker-free by design: every argument is plain data, so IsMarkerFree<args>
// is true and the Draft-07 keyword table can bind to it. The method name is
// the legacy public surface (docs/legacy-public-surface.md): arrayMinLength's
// method really is `minLength`, NOT `minItems`. The keyword table is where
// `minItems -> minLength` is written down, and that binding is type-checked,
// so the legacy silent duck-typing cannot come back.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isNumber, isString } from "../../types";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";
import { check } from "../../plugin-kit/create-rule";

export const stringMaxPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [max: number];
  out: Unchanged;
  context: { max: number; actual: number };
}>()({
  name: "stringMax",
  method: "max",
  slots: ["string"] as const,
  build: (ctx, max) => {
    if (!Number.isFinite(max) || max < 0)
      throw new PluginArgumentError(ctx.pluginName, "max", max);
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || value.length <= max
          ? PASS
          : fail({ expected: max, actual: value.length }),
      describe: (detail) =>
        `String must have at most ${String(detail.expected)} characters`,
      buildMessageContext: (detail) => ({
        max,
        actual: isNumber(detail.actual) ? detail.actual : 0,
      }),
    });
  },
});
