import { definePlugin } from "../plugin-kit/plugin-definition";
import { branch, composite } from "../plugin-kit/create-rule";
import { PASS } from "../types";
import type { CheckOutcome, RuleContext } from "../types";
import type {
  BranchRunner,
  CompositeBranch,
} from "../plugin-kit/compiled-rule";
import type { NarrowedChain, Unchanged } from "../plugin-kit/marker.types";

function takenBranch(label: string | undefined): "then" | "else" | "none" {
  if (label === "then") return "then";
  if (label === "else") return "else";
  return "none";
}

function routeConditional(
  runners: readonly BranchRunner[],
  thenIndex: number,
  elseIndex: number
): (value: unknown, ctx: RuleContext) => CheckOutcome {
  const condition = runners[0];
  return (value, ctx) => {
    if (condition === undefined) return PASS;
    const taken = condition.run(value, ctx).ok ? thenIndex : elseIndex;
    if (taken < 0) return PASS;
    const runner = runners[taken];
    return runner === undefined ? PASS : runner.run(value, ctx);
  };
}

/**
 * REPAIR: if/then/else constrains the SAME instance, not its elements, so its
 * sub-chains are NarrowedChain (a chain over Present<TValue, TState>) and not
 * ElementChain (a chain over ElementOf<TValue>).
 */
export const conditionalSchemaPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [
    condition: NarrowedChain,
    then?: NarrowedChain,
    otherwise?: NarrowedChain,
  ];
  out: Unchanged;
  context: { taken: "then" | "else" | "none" };
}>()({
  name: "conditionalSchema",
  method: "conditionalSchema",
  slots: ["object", "array", "string", "number", "boolean"] as const,
  build: (ctx, condition, then, otherwise) => {
    const branches: CompositeBranch[] = [branch("if", condition)];
    const thenIndex =
      then === undefined ? -1 : branches.push(branch("then", then)) - 1;
    const elseIndex =
      otherwise === undefined
        ? -1
        : branches.push(branch("else", otherwise)) - 1;
    return composite({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches,
      combine: (runners) => routeConditional(runners, thenIndex, elseIndex),
      describe: (detail) =>
        `Value must match the "${detail.branch ?? "then"}" schema`,
      buildMessageContext: (detail) => ({ taken: takenBranch(detail.branch) }),
    });
  },
});
