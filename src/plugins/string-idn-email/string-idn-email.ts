// ===========================================================================
// L7  src/plugins/string-idn-email/string-idn-email.ts
// `.idnEmail()` and the Draft-07 `idn-email` format. Before this plugin
// existed the format map declared the name UNSUPPORTED, so every schema
// carrying it threw at build time and produced no validator at all.
//
// stringEmail owns the ASCII RFC 5322 grammar and this owns the RFC 6531
// internationalized one: two formats, two homes.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import type { MessageContextExtra } from "../../types";
import { isIdnEmail } from "./idn-email";

export const stringIdnEmailPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "stringIdnEmail",
  method: "idnEmail",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || isIdnEmail(value) ? PASS : fail({ actual: value }),
      describe: () =>
        "Value must be a valid internationalized email address (RFC 6531)",
      buildMessageContext: () => ({}),
    }),
});
