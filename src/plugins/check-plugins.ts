import {
  definePlugin,
  PluginArgumentError,
} from "../plugin-kit/plugin-definition";
import { check, transform } from "../plugin-kit/create-rule";
import { fail, isNumber, isPlainObject, isString, PASS } from "../types";
import type { MessageContextExtra } from "../types";
import type {
  FieldRef,
  SelfReader,
  TransformOut,
  Unchanged,
} from "../plugin-kit/marker.types";
import { ALL_SLOTS } from "./presence-plugins";

/** check with a NARROW message context: the typed factory needs no cast. */
export const stringMinPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [min: number];
  out: Unchanged;
  context: { min: number; actual: number };
}>()({
  name: "stringMin",
  method: "min",
  slots: ["string"] as const,
  build: (ctx, min) => {
    if (!Number.isFinite(min) || min < 0) {
      throw new PluginArgumentError(ctx.pluginName, "min", min);
    }
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || value.length >= min
          ? PASS
          : fail({ expected: min, actual: value.length }),
      describe: (detail) =>
        `String must have at least ${String(detail.expected)} characters`,
      buildMessageContext: (detail) => ({
        min,
        actual: isNumber(detail.actual) ? detail.actual : 0,
      }),
    });
  },
});

export const numberMinPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [min: number];
  out: Unchanged;
  context: { min: number };
}>()({
  name: "numberMin",
  method: "min",
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
      describe: (detail) =>
        `Number must be at least ${String(detail.expected)}`,
      buildMessageContext: () => ({ min }),
    }),
});

function readKeys(root: unknown, keys: readonly string[]): unknown {
  let current: unknown = root;
  for (const key of keys) {
    // A type GUARD, not an assertion: src/core/type-erasure.ts is the only
    // file in src/ permitted to assert, and this walk does not need to.
    if (!isPlainObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

function comparesAs(
  left: unknown,
  right: unknown,
  operator: "eq" | "gt" | "lt"
): boolean {
  if (operator === "eq") return left === right;
  if (typeof left === "number" && typeof right === "number") {
    return operator === "gt" ? left > right : left < right;
  }
  if (typeof left === "string" && typeof right === "string") {
    return operator === "gt" ? left > right : left < right;
  }
  return false;
}

/** a FieldRef marker: `other` is a real string inside build. */
export const compareFieldPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [other: FieldRef, operator: "eq" | "gt" | "lt"];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "compareField",
  method: "compareField",
  slots: ["string", "number", "date"] as const,
  build: (ctx, other, operator) => {
    const keys = other.split(".");
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value, ruleContext) =>
        comparesAs(value, readKeys(ruleContext.root, keys), operator)
          ? PASS
          : fail({ expected: other, actual: value }),
      describe: (detail) => `Must be ${operator} ${String(detail.expected)}`,
      buildMessageContext: () => ({}),
    });
  },
});

/** transform: TransformOut + a SelfReader argument. */
export const transformPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [map: SelfReader<unknown>];
  out: TransformOut;
  context: MessageContextExtra;
}>()({
  name: "transform",
  method: "transform",
  slots: ALL_SLOTS,
  build: (_ctx, map) => transform((value) => map(value)),
});
