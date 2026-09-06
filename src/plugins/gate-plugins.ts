import { definePlugin } from "../plugin-kit/plugin-definition";
import { check, gate } from "../plugin-kit/create-rule";
import { fail, PASS } from "../types";
import type { MessageContextExtra } from "../types";
import type {
  FieldRefs,
  RootPredicate,
  RootReader,
  SelfValue,
  Unchanged,
} from "../plugin-kit/marker.types";
import { ALL_SLOTS } from "./presence-plugins";

/** RootPredicate marker -> a GateRule. */
export const validateIfPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [when: RootPredicate];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "validateIf",
  method: "validateIf",
  slots: ALL_SLOTS,
  build: (ctx, when) =>
    gate(ctx.code, (_value, ruleContext) =>
      when(ruleContext.root, ruleContext.item)
    ),
});

/** RootReader marker: the plugin sees `(root: unknown) => number`. */
export const compareToRootPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [read: RootReader<number>];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "compareToRoot",
  method: "compareToRoot",
  slots: ["number"] as const,
  build: (ctx, read) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value, ruleContext) =>
        value === read(ruleContext.root) ? PASS : fail({ actual: value }),
      describe: () => "Value must equal the value read from the root",
      buildMessageContext: () => ({}),
    }),
});

/** FieldRefs + SelfValue markers in one signature. */
export const stitchPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [sources: FieldRefs, fallback: SelfValue];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "stitch",
  method: "stitch",
  slots: ALL_SLOTS,
  build: (ctx, sources, fallback) => {
    const paths: readonly string[] = sources;
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        paths.length > 0 || value === fallback ? PASS : fail({ actual: value }),
      describe: () => `Stitched from ${paths.join(", ")}`,
      buildMessageContext: () => ({}),
    });
  },
});
