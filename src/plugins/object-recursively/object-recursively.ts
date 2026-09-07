// ===========================================================================
// L7  src/plugins/object-recursively/object-recursively.ts
// `recursively("self")` / `recursively("element")`: pure DECLARATION.
//
// There is deliberately no loop, no depth counter and no visited set in this
// file. A RecursiveRule says "re-enter this plan here, at most maxDepth deep";
// src/compile/resolve-recursion.ts turns it into a policy holding a late-bound
// PlanRef, and src/runtime/run-recursion.ts is the only place that descends.
// Legacy put the descent in validator-factory.ts instead, and that is exactly
// why `recursively("__Self")` worked on a plain object but failed on an array
// element path: a second execution path only has to be forgotten once.
//
// Legacy semantics kept (docs/legacy-spec/plugin-catalog-structural.md#objectRecursivelyPlugin):
// maxDepth defaults to 10, and a cycle ends the descent silently. What changed
// is that exceeding maxDepth is now REPORTED rather than treated as success —
// see the header of src/runtime/run-recursion.ts for why silence was wrong.
//
// The legacy markers "__Self" / "__Element" become "self" / "element": the
// double underscore was there to keep the marker out of a field-path namespace
// this design does not have (`target` is not a path), and RecursionTarget in
// src/plugin-kit/compiled-rule.ts is the closed vocabulary they map onto.
// ===========================================================================
import type { MessageContextExtra } from "../../types";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { recursive } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";
import type { RecursionTarget } from "../../plugin-kit/compiled-rule";

export interface RecursivelyOptions {
  readonly maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 10;

export const objectRecursivelyPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [target: RecursionTarget, options?: RecursivelyOptions];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "objectRecursively",
  method: "recursively",
  slots: ["object", "array"] as const,
  build: (ctx, target, options) => {
    const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
    if (!Number.isInteger(maxDepth) || maxDepth < 1) {
      throw new PluginArgumentError(ctx.pluginName, "maxDepth", maxDepth);
    }
    return recursive({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      target,
      maxDepth,
      describe: (detail) =>
        `Recursive validation stopped at the maximum depth of ${String(detail.expected)}`,
      buildMessageContext: () => ({}),
    });
  },
});
