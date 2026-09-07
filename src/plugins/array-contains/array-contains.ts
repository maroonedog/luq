// ===========================================================================
// L7  src/plugins/array-contains/array-contains.ts
// Draft-07 `contains` / `minContains` / `maxContains`.
//
// A COMPOSITE, not a check: the element schema arrives as an ElementChain that
// the chain has already collected into rules, becomes ONE branch, and the
// engine turns that branch into a runner. The plugin never touches a Rule, so
// there is no second execution path here — only counting.
//
// Legacy replaced (docs/legacy-spec/plugin-catalog-structural.md#arrayContainsPlugin):
//   * three argument shapes (a value, a {validator}, a JSONSchema7) and a
//     private mini schema evaluator: all three collapse into the sub-chain,
//     which is the same engine every other rule runs on;
//   * a non-array returned FALSE, alone among the array plugins. It passes
//     here, because the array type guard owns type errors;
//   * the code was the only SCREAMING_SNAKE in the catalog and no options bag
//     was accepted. Both now follow the one rule: code defaults to the plugin
//     name and options.code / options.messageFactory work.
// ===========================================================================
import { PASS, fail, isArray, isNumber } from "../../types";
import type { CheckOutcome, RuleContext } from "../../types";
import { branch, composite } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";
import type { BranchRunner } from "../../plugin-kit/compiled-rule";
import type { ElementChain, Unchanged } from "../../plugin-kit/marker.types";

export interface ArrayContainsBounds {
  readonly min?: number;
  readonly max?: number;
}

export interface ArrayContainsContext {
  readonly matched: number;
  readonly min: number;
  readonly max: number;
}

/**
 * Counting stops as soon as the count passes `max`: a further match cannot
 * change the answer, and the array may be long.
 */
function countMatchingElements(
  runners: readonly BranchRunner[],
  min: number,
  max: number
): (value: unknown, ctx: RuleContext) => CheckOutcome {
  const matcher = runners[0];
  return (value, ctx) => {
    if (matcher === undefined || !isArray(value)) return PASS;
    let matched = 0;
    for (const element of value) {
      if (matcher.run(element, ctx).ok) matched += 1;
      if (matched > max) break;
    }
    return matched < min || matched > max
      ? fail({ expected: min, actual: matched, branch: matcher.label })
      : PASS;
  };
}

/**
 * WHICH argument positions carry a sub-chain cannot be recovered from a
 * plugin's type at run time — a NarrowedChain and a RootPredicate are both
 * plain functions once erased — so src/chain/collect-branch-rules.ts reads it
 * from this declared field. definePlugin's spec does not carry it yet (see
 * needsFromOthers), which is why it is spread on rather than passed in.
 */
export const arrayContainsPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [element: ElementChain, bounds?: ArrayContainsBounds];
  out: Unchanged;
  context: ArrayContainsContext;
}>()({
  name: "arrayContains",
  method: "contains",
  slots: ["array", "tuple"] as const,
  build: (ctx, element, bounds) => {
    const min = bounds?.min ?? 1;
    const max = bounds?.max ?? Number.POSITIVE_INFINITY;
    if (!isNumber(min) || Number.isNaN(min) || min < 0) {
      throw new PluginArgumentError(ctx.pluginName, "bounds.min", min);
    }
    if (!isNumber(max) || Number.isNaN(max) || max < min) {
      throw new PluginArgumentError(ctx.pluginName, "bounds.max", max);
    }
    return composite<ArrayContainsContext>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches: [branch("contains", element)],
      combine: (runners) => countMatchingElements(runners, min, max),
      describe: (detail) =>
        `Array must contain at least ${String(min)} matching element(s), but got ${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        matched: isNumber(detail.actual) ? detail.actual : 0,
        min,
        max,
      }),
    });
  },
  subChainArguments: [0],
});
