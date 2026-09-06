import { definePlugin } from "../plugin-kit/plugin-definition";
import { presence } from "../plugin-kit/create-rule";
import type { MessageContextExtra, TypeName } from "../types";
import type { PresenceShift } from "../plugin-kit/marker.types";

export const ALL_SLOTS: readonly TypeName[] = [
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

/** presence: `out` is a PresenceShift, so RuleForOut demands a PresenceRule. */
export const requiredPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: PresenceShift<"excludeMissing">;
  context: MessageContextExtra;
}>()({
  name: "required",
  method: "required",
  slots: ALL_SLOTS,
  build: (ctx) =>
    presence({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      allowUndefined: false,
      allowNull: false,
      emptyStringIsMissing: true,
      describe: () => "This field is required",
      buildMessageContext: () => ({}),
    }),
});

export const optionalPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: PresenceShift<"excludeNull">;
  context: MessageContextExtra;
}>()({
  name: "optional",
  method: "optional",
  slots: ALL_SLOTS,
  build: (ctx) =>
    presence({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      allowUndefined: true,
      allowNull: false,
      emptyStringIsMissing: false,
      describe: () => "This field is optional",
      buildMessageContext: () => ({}),
    }),
});

export const nullablePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: PresenceShift<"allowNull">;
  context: MessageContextExtra;
}>()({
  name: "nullable",
  method: "nullable",
  slots: ALL_SLOTS,
  build: (ctx) =>
    presence({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      allowUndefined: false,
      allowNull: true,
      emptyStringIsMissing: false,
      describe: () => "This field may be null",
      buildMessageContext: () => ({}),
    }),
});
