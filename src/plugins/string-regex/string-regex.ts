// ===========================================================================
// L7  src/plugins/string-regex/string-regex.ts
// `.regex()` and the Draft-07 `regex` format. Before this plugin existed the
// format map declared `regex` UNSUPPORTED, which made every schema carrying it
// throw at build time instead of validating.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import type { MessageContextExtra } from "../../types";
import { isEcma262Regex } from "./is-ecma262-regex";

export const stringRegexPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "stringRegex",
  method: "regex",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || isEcma262Regex(value)
          ? PASS
          : fail({ actual: value }),
      describe: () => "Value must be a valid ECMA-262 regular expression",
      buildMessageContext: () => ({}),
    }),
});
