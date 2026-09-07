// ===========================================================================
// L7  src/plugins/string-hostname/string-hostname.ts
// `.hostname()` and the Draft-07 `hostname` format. RFC 1123: total length
// <= 253, each label 1-63 characters, alphanumeric at both ends, hyphens
// inside only, no underscore, no trailing dot, ASCII only (no IDN).
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import type { MessageContextExtra } from "../../types";

const MAX_HOSTNAME_LENGTH = 253;
const RFC_1123 =
  /^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])(\.([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]))*$/;

export const stringHostnamePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "stringHostname",
  method: "hostname",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) ||
        (value.length <= MAX_HOSTNAME_LENGTH && RFC_1123.test(value))
          ? PASS
          : fail({ actual: value }),
      describe: () => "Value must be a valid hostname",
      buildMessageContext: () => ({}),
    }),
});
