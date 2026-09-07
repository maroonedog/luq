// ===========================================================================
// L7  src/plugins/string-starts-with/string-starts-with.ts
// `.startsWith(prefix)`. An EMPTY prefix always passes (the legacy fast path).
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";

export const stringStartsWithPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [prefix: string];
  out: Unchanged;
  context: { readonly prefix: string };
}>()({
  name: "stringStartsWith",
  method: "startsWith",
  slots: ["string"] as const,
  build: (ctx, prefix) => {
    if (!isString(prefix)) {
      throw new PluginArgumentError(ctx.pluginName, "prefix", prefix);
    }
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        prefix.length === 0 || !isString(value) || value.startsWith(prefix)
          ? PASS
          : fail({ expected: prefix, actual: value }),
      describe: () => `String must start with "${prefix}"`,
      buildMessageContext: () => ({ prefix }),
    });
  },
});
