// ===========================================================================
// L7  src/plugins/required/required.ts
//
// `out` is a PresenceShift, so RuleForOut demands a PresenceRule: the TYPE the
// chain carries afterwards and the RUNTIME policy the field gets come from the
// same declaration and cannot drift apart.
//
// Legacy emptiness is carried over verbatim: undefined, null and "" are
// absent; 0, false, [] and {} are present. That is a deliberate form-oriented
// choice users depend on (legacy-spec/plugin-catalog-core.md).
// ===========================================================================
import { presence } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { MessageContextExtra, TypeName } from "../../types";
import type { PresenceShift } from "../../plugin-kit/marker.types";

const REQUIRED_SLOTS: readonly TypeName[] = [
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

export const requiredPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: PresenceShift<"excludeMissing">;
  context: MessageContextExtra;
}>()({
  name: "required",
  method: "required",
  slots: REQUIRED_SLOTS,
  build: (ctx) =>
    presence({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      allowUndefined: false,
      allowNull: false,
      emptyStringIsMissing: true,
      describe: (messageContext) => `${messageContext.path} is required`,
      buildMessageContext: () => ({}),
    }),
});
