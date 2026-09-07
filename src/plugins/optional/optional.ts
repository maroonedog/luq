// ===========================================================================
// L7  src/plugins/optional/optional.ts
//
// `.optional()` accepts a MISSING value and still rejects an explicit null:
// legacy's optional returned false for null and said so in its message, and
// that split between "not there" and "there, and null" is the whole point of
// having both optional and nullable.
//
// The empty string is NOT absence here (emptyStringIsMissing: false), which is
// why `.optional().min(3)` still judges "" — legacy did the same.
// ===========================================================================
import { presence } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { MessageContextExtra, TypeName } from "../../types";
import type { PresenceShift } from "../../plugin-kit/marker.types";

const OPTIONAL_SLOTS: readonly TypeName[] = [
  "string",
  "number",
  "boolean",
  "date",
  "array",
  "tuple",
  "object",
  "union",
  "any",
];

export const optionalPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: PresenceShift<"excludeNull">;
  context: MessageContextExtra;
}>()({
  name: "optional",
  method: "optional",
  slots: OPTIONAL_SLOTS,
  build: (ctx) =>
    presence({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      allowUndefined: true,
      allowNull: false,
      emptyStringIsMissing: false,
      describe: (messageContext) =>
        `${messageContext.path} cannot be null (use undefined for optional fields)`,
      buildMessageContext: () => ({}),
    }),
});
