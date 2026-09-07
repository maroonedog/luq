// ===========================================================================
// L7  src/plugins/object-max-properties/object-max-properties.ts
// Draft-07 `maxProperties`, the exact mirror of objectMinProperties
// (docs/legacy-spec/plugin-catalog-structural.md#objectMaxPropertiesPlugin):
// a non-object passes, the count is own enumerable keys, the bound is
// inclusive, and the message context is {max, actual}.
// ===========================================================================
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isNumber, isPlainObject } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";

export interface ObjectMaxPropertiesContext {
  readonly max: number;
  readonly actual: number;
}

export const objectMaxPropertiesPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [max: number];
  out: Unchanged;
  context: ObjectMaxPropertiesContext;
}>()({
  name: "objectMaxProperties",
  method: "maxProperties",
  slots: ["object"] as const,
  build: (ctx, max) => {
    if (!isNumber(max) || !Number.isFinite(max) || max < 0) {
      throw new PluginArgumentError(ctx.pluginName, "max", max);
    }
    return check<ObjectMaxPropertiesContext>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) => {
        if (!isPlainObject(value)) return PASS;
        const count = Object.keys(value).length;
        return count <= max ? PASS : fail({ expected: max, actual: count });
      },
      describe: (detail) =>
        `Must have at most ${String(max)} properties, but has ${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        max,
        actual: isNumber(detail.actual) ? detail.actual : 0,
      }),
    });
  },
});
