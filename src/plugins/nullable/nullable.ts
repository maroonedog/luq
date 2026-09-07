// ===========================================================================
// L7  src/plugins/nullable/nullable.ts
//
// The mirror of optional: null is accepted, a missing value is not. Legacy's
// nullable `check` returned true unconditionally and merely set a skipForNull
// flag, so its "cannot be undefined" message was unreachable; here the same
// intent is expressed as the presence policy itself, and the message is real.
// ===========================================================================
import { presence } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { MessageContextExtra, TypeName } from "../../types";
import type { PresenceShift } from "../../plugin-kit/marker.types";

const NULLABLE_SLOTS: readonly TypeName[] = [
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

export const nullablePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: PresenceShift<"allowNull">;
  context: MessageContextExtra;
}>()({
  name: "nullable",
  method: "nullable",
  slots: NULLABLE_SLOTS,
  build: (ctx) =>
    presence({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      allowUndefined: false,
      allowNull: true,
      emptyStringIsMissing: false,
      describe: (messageContext) =>
        `${messageContext.path} cannot be undefined (use null for nullable fields)`,
      buildMessageContext: () => ({}),
    }),
});
