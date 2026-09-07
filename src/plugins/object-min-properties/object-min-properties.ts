// ===========================================================================
// L7  src/plugins/object-min-properties/object-min-properties.ts
// Draft-07 `minProperties`.
//
// Legacy semantics (docs/legacy-spec/plugin-catalog-structural.md#objectMinPropertiesPlugin):
// a non-object PASSES, the count is Object.keys().length (own enumerable keys
// only), the message is `Must have at least N properties, but has M` and the
// message context is {min, actual}.
//
// LEGACY BUGS FIXED: legacy tested `typeof value !== "object"`, so an ARRAY
// counted its indices as properties; isPlainObject excludes it. And legacy's
// argument guard threw into attachPluginMethods' try/catch, which swallowed it
// and dropped the rule silently — the throw now reaches the caller.
//
// Marker-free so the Draft-07 keyword table can bind `minProperties` to it.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isNumber, isPlainObject } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";

export interface ObjectMinPropertiesContext {
  readonly min: number;
  readonly actual: number;
}

export const objectMinPropertiesPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [min: number];
  out: Unchanged;
  context: ObjectMinPropertiesContext;
}>()({
  name: "objectMinProperties",
  method: "minProperties",
  slots: ["object"] as const,
  build: (ctx, min) => {
    if (!isNumber(min) || !Number.isFinite(min) || min < 0) {
      throw new PluginArgumentError(ctx.pluginName, "min", min);
    }
    return check<ObjectMinPropertiesContext>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) => {
        if (!isPlainObject(value)) return PASS;
        const count = Object.keys(value).length;
        return count >= min ? PASS : fail({ expected: min, actual: count });
      },
      describe: (detail) =>
        `Must have at least ${String(min)} properties, but has ${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        min,
        actual: isNumber(detail.actual) ? detail.actual : 0,
      }),
    });
  },
});
