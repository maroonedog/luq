// ===========================================================================
// L7  src/plugins/string-json-pointer/string-json-pointer.ts
// `.jsonPointer()` and the Draft-07 `json-pointer` format (RFC 6901).
//
// The empty string is a valid pointer (it selects the whole document).
// Otherwise the value is a run of "/"-prefixed tokens in which "~" is only
// legal as "~0" or "~1".
//
// The 1.x plugin's pattern nested two unbounded quantifiers over a class that
// also matched "/", which backtracks quadratically on a long near-miss. The
// JSON Schema table's variant excluded "/" from the token class and is the one
// kept: same language, one pass.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import type { MessageContextExtra } from "../../types";

const JSON_POINTER = /^(?:\/(?:[^~/]|~[01])*)*$/;

export const stringJsonPointerPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "stringJsonPointer",
  method: "jsonPointer",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || JSON_POINTER.test(value)
          ? PASS
          : fail({ actual: value }),
      describe: () => "Value must be a valid JSON Pointer (RFC 6901)",
      buildMessageContext: () => ({}),
    }),
});
