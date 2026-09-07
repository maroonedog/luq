// ===========================================================================
// L7  src/plugins/string-ends-with/string-ends-with.ts
// `.endsWith(suffix)`. An EMPTY suffix always passes (the legacy fast path).
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";

export const stringEndsWithPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [suffix: string];
  out: Unchanged;
  context: { readonly suffix: string };
}>()({
  name: "stringEndsWith",
  method: "endsWith",
  slots: ["string"] as const,
  build: (ctx, suffix) => {
    if (!isString(suffix)) {
      throw new PluginArgumentError(ctx.pluginName, "suffix", suffix);
    }
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        suffix.length === 0 || !isString(value) || value.endsWith(suffix)
          ? PASS
          : fail({ expected: suffix, actual: value }),
      describe: () => `String must end with "${suffix}"`,
      buildMessageContext: () => ({ suffix }),
    });
  },
});
