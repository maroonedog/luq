// ===========================================================================
// L7  src/plugins/array-each/array-each.ts — the ElementChain workhorse.
// The element rules become ONE branch and the ENGINE runs it: a plugin never
// loops over rules itself, because execution exists in exactly one place.
//
// The loop below walks VALUES, not rules. It is the one thing this plugin
// knows that the engine cannot: which member of the subject a branch applies
// to. `runner.run` is the compiled branch, the same call shape as a check.
// ===========================================================================
import { definePlugin } from "../../plugin-kit/plugin-definition";
import { branch, composite } from "../../plugin-kit/create-rule";
import { fail, isArray, PASS } from "../../types";
import type { MessageContextExtra } from "../../types";
import type { ElementChain, Unchanged } from "../../plugin-kit/marker.types";

/**
 * WHICH argument positions carry a sub-chain cannot be recovered from a
 * plugin's type at run time — a NarrowedChain and a RootPredicate are both
 * plain functions once erased — so src/chain/collect-branch-rules.ts reads it
 * from this declared field. definePlugin's spec does not carry it yet (see
 * needsFromOthers), which is why it is spread on rather than passed in.
 */
export const arrayEachPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [element: ElementChain];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "arrayEach",
  method: "each",
  slots: ["array", "tuple"] as const,
  build: (ctx, element) =>
    composite({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches: [branch("element", element)],
      combine: (runners) => {
        const runner = runners[0];
        if (runner === undefined) return () => PASS;
        return (value, runCtx) => {
          if (!isArray(value)) return PASS;
          for (let index = 0; index < value.length; index += 1) {
            const outcome = runner.run(value[index], runCtx);
            if (!outcome.ok)
              return fail({ ...outcome.detail, index, branch: runner.label });
          }
          return PASS;
        };
      },
      describe: (detail) => `Element ${String(detail.index)} failed`,
      buildMessageContext: () => ({}),
    }),
  subChainArguments: [0],
});
