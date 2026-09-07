// ===========================================================================
// L7  src/plugins/string-pattern/string-pattern.ts
// `.pattern(re)`.
//
// TWO legacy defects are closed here.
//   1. It accepted a `string` and compiled it with `new RegExp(s)`, silently
//      dropping flags and giving no compile-time check. Only a RegExp is
//      accepted now, and a non-RegExp throws at BUILD time.
//   2. A caller's `/g` (or `/y`) RegExp carries mutable `lastIndex` across
//      calls, so the SAME value alternated between valid and invalid. The
//      pattern is cloned here without those two flags, which makes the rule
//      stateless no matter what the caller hands in.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";

const STATEFUL_FLAGS = /[gy]/g;

function isRegExp(value: unknown): value is RegExp {
  return value instanceof RegExp;
}

/** A clone with `g` and `y` removed: `test` can no longer move lastIndex. */
function toStatelessPattern(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags.replace(STATEFUL_FLAGS, ""));
}

export const stringPatternPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [pattern: RegExp];
  out: Unchanged;
  context: { readonly pattern: string };
}>()({
  name: "stringPattern",
  method: "pattern",
  slots: ["string"] as const,
  build: (ctx, pattern) => {
    if (!isRegExp(pattern)) {
      throw new PluginArgumentError(ctx.pluginName, "pattern", pattern);
    }
    const stateless = toStatelessPattern(pattern);
    const printed = pattern.toString();
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || stateless.test(value)
          ? PASS
          : fail({ expected: printed, actual: value }),
      describe: () => "Invalid format",
      buildMessageContext: () => ({ pattern: printed }),
    });
  },
});
