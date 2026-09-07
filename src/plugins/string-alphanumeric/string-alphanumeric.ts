// ===========================================================================
// L7  src/plugins/string-alphanumeric/string-alphanumeric.ts
// `.alphanumeric(allowSpaces?)`. ASCII only, and the EMPTY STRING FAILS
// (both patterns are `+`), exactly as in 1.x.
//
// The legacy code moved its ERROR CODE when allowSpaces was true
// ("stringAlphanumeric_with_spaces"). An option value must not move the code,
// so the code is always the plugin name and allowSpaces reaches a message
// factory through the message context instead.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";

const ALPHANUMERIC = /^[a-zA-Z0-9]+$/;
const ALPHANUMERIC_WITH_SPACES = /^[a-zA-Z0-9\s]+$/;

export const stringAlphanumericPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [allowSpaces?: boolean];
  out: Unchanged;
  context: { readonly allowSpaces: boolean };
}>()({
  name: "stringAlphanumeric",
  method: "alphanumeric",
  slots: ["string"] as const,
  build: (ctx, allowSpaces) => {
    const spacesAllowed = allowSpaces === true;
    const pattern = spacesAllowed ? ALPHANUMERIC_WITH_SPACES : ALPHANUMERIC;
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || pattern.test(value)
          ? PASS
          : fail({ actual: value }),
      describe: () =>
        spacesAllowed
          ? "String must contain only alphanumeric characters and spaces"
          : "String must contain only alphanumeric characters",
      buildMessageContext: () => ({ allowSpaces: spacesAllowed }),
    });
  },
});
