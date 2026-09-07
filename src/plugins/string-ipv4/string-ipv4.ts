// ===========================================================================
// L7  src/plugins/string-ipv4/string-ipv4.ts
// `.ipv4()` and the Draft-07 `ipv4` format.
//
// LEGACY DEFECT FIXED: the 1.x pattern's `[01]?[0-9][0-9]?` alternative
// accepted "01" and "001" while the plugin's own JSDoc claimed leading zeros
// were rejected. The doc was right and the pattern was wrong — a leading zero
// makes a dotted quad ambiguous (some resolvers read it as octal), and the
// JSON Schema draft7 format suite requires rejecting it. Rejected now.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import type { MessageContextExtra } from "../../types";

const DOTTED_QUAD =
  /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])$/;

export const stringIpv4Plugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "stringIpv4",
  method: "ipv4",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || DOTTED_QUAD.test(value)
          ? PASS
          : fail({ actual: value }),
      describe: () => "Value must be a valid IPv4 address",
      buildMessageContext: () => ({}),
    }),
});
