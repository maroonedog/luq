// ===========================================================================
// L7  src/plugins/string-idn-hostname/string-idn-hostname.ts
// `.idnHostname()` and the Draft-07 `idn-hostname` format. Before this plugin
// existed the format map declared the name UNSUPPORTED, so every schema
// carrying it threw at build time and produced no validator at all.
//
// stringHostname owns the ASCII-only RFC 1123 grammar and this owns the
// internationalized one: two formats, two homes, no shared regex.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import type { MessageContextExtra } from "../../types";
import { isIdnHostname } from "./idn-hostname";

export const stringIdnHostnamePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "stringIdnHostname",
  method: "idnHostname",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || isIdnHostname(value)
          ? PASS
          : fail({ actual: value }),
      describe: () =>
        "Value must be a valid internationalized hostname (RFC 5890)",
      buildMessageContext: () => ({}),
    }),
});
