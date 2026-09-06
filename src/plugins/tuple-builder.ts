import { definePlugin } from "../plugin-kit/plugin-definition";
import { branch, composite } from "../plugin-kit/create-rule";
import { fail, isArray, isNumber, PASS } from "../types";
import type { CheckOutcome, RuleContext } from "../types";
import type {
  BranchRunner,
  CompositeBranch,
} from "../plugin-kit/compiled-rule";
import type { ElementChain, Unchanged } from "../plugin-kit/marker.types";

function applyPositionally(
  runners: readonly BranchRunner[],
  positionCount: number,
  hasRest: boolean
): (value: unknown, ctx: RuleContext) => CheckOutcome {
  return (value, ctx) => {
    if (!isArray(value))
      return fail({ expected: "array", actual: typeof value });
    if (!hasRest && value.length > positionCount) {
      return fail({ expected: positionCount, actual: value.length });
    }
    for (let index = 0; index < value.length; index += 1) {
      const runner =
        index < positionCount ? runners[index] : runners[positionCount];
      if (runner === undefined) continue;
      const outcome = runner.run(value[index], ctx);
      if (!outcome.ok) {
        return fail({ ...outcome.detail, index, branch: runner.label });
      }
    }
    return PASS;
  };
}

/**
 * CONTRADICTION A-15: positions is an ARRAY of ElementChain markers. Both
 * resolvers must descend into the array and resolve each element.
 */
export const tupleBuilderPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [positions: readonly ElementChain[], rest?: ElementChain];
  out: Unchanged;
  context: { positionCount: number; index: number };
}>()({
  name: "tupleBuilder",
  method: "builder",
  slots: ["tuple"] as const,
  build: (ctx, positions, rest) => {
    const branches: CompositeBranch[] = positions.map((rules, index) =>
      branch(`position:${String(index)}`, rules)
    );
    if (rest !== undefined) branches.push(branch("rest", rest));
    return composite({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches,
      combine: (runners) =>
        applyPositionally(runners, positions.length, rest !== undefined),
      describe: (detail) => `Tuple element ${String(detail.index)} is invalid`,
      buildMessageContext: (detail) => ({
        positionCount: positions.length,
        index: isNumber(detail.index) ? detail.index : -1,
      }),
    });
  },
});
