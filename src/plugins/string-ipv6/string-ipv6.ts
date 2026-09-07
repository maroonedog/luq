// ===========================================================================
// L7  src/plugins/string-ipv6/string-ipv6.ts
// `.ipv6()` and the Draft-07 `ipv6` format. The grammar lives next door in
// ipv6-address.ts; this file is only the plugin identity and the message.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import type { MessageContextExtra } from "../../types";
import { isIpv6Address } from "./ipv6-address";

export const stringIpv6Plugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "stringIpv6",
  method: "ipv6",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || isIpv6Address(value)
          ? PASS
          : fail({ actual: value }),
      describe: () => "Value must be a valid IPv6 address",
      buildMessageContext: () => ({}),
    }),
});
