// ===========================================================================
// L7  src/plugins/string-relative-json-pointer/string-relative-json-pointer.ts
// `.relativeJsonPointer()` and the `relative-json-pointer` format.
//
// LEGACY DEFECT FIXED: the JSON Schema format table tested only
// /^[0-9]+#?$/ — it never looked at the JSON Pointer half, so "0/foo~2" passed
// there and failed in the plugin. The plugin's reading is the correct one and
// is now the only one: a non-negative integer with NO leading zeros, then
// either nothing, or "#", or an RFC 6901 pointer starting with "/".
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isString } from "../../types";
import type { MessageContextExtra } from "../../types";

const LEADING_COUNT = /^(?:0|[1-9][0-9]*)/;
const JSON_POINTER = /^(?:\/(?:[^~/]|~[01])*)*$/;

function isRelativeJsonPointer(value: string): boolean {
  const count = LEADING_COUNT.exec(value);
  if (count === null) return false;
  const rest = value.slice(count[0].length);
  if (rest.length === 0 || rest === "#") return true;
  return rest.startsWith("/") && JSON_POINTER.test(rest);
}

export const stringRelativeJsonPointerPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "stringRelativeJsonPointer",
  method: "relativeJsonPointer",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || isRelativeJsonPointer(value)
          ? PASS
          : fail({ actual: value }),
      describe: () => "Value must be a valid Relative JSON Pointer",
      buildMessageContext: () => ({}),
    }),
});
