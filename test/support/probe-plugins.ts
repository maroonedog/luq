// ===========================================================================
// test/support/probe-plugins.ts
// Three deliberately trivial plugins the collection tests use to FILL a
// sub-chain and to demand presence.
//
// They exist so this category's tests depend on NO other category: a sub-chain
// has to contain a rule to be worth running, and borrowing stringMin or
// numberMin would tie every array/object/tuple test to the string and number
// catalogues, which are being written in parallel. The thing under test is
// always the collection plugin around them.
// ===========================================================================
import { definePlugin } from "../../src/plugin-kit/plugin-definition";
import { check, presence } from "../../src/plugin-kit/create-rule";
import { PASS, fail, isNumber, isString } from "../../src/types";
import type { MessageContextExtra } from "../../src/types";
import type {
  PresenceShift,
  Unchanged,
} from "../../src/plugin-kit/marker.types";

export const probeAtLeastPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [min: number];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "probeAtLeast",
  method: "atLeast",
  slots: ["number"] as const,
  build: (ctx, min) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isNumber(value) || value >= min
          ? PASS
          : fail({ expected: min, actual: value }),
      describe: () => `Number must be at least ${String(min)}`,
      buildMessageContext: () => ({}),
    }),
});

export const probeMinCharsPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [min: number];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "probeMinChars",
  method: "minChars",
  slots: ["string"] as const,
  build: (ctx, min) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || value.length >= min
          ? PASS
          : fail({ expected: min, actual: value.length }),
      describe: () => `String must have at least ${String(min)} characters`,
      buildMessageContext: () => ({}),
    }),
});

export const probePresentPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: PresenceShift<"excludeMissing">;
  context: MessageContextExtra;
}>()({
  name: "probePresent",
  method: "present",
  slots: [
    "string",
    "number",
    "boolean",
    "date",
    "array",
    "tuple",
    "object",
    "union",
    "any",
  ] as const,
  build: (ctx) =>
    presence({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      allowUndefined: false,
      allowNull: false,
      emptyStringIsMissing: false,
      describe: () => "Value is required",
      buildMessageContext: () => ({}),
    }),
});
