// ===========================================================================
// test/support/conditional-schema-as-designed.ts
//
// conditionalSchema EXACTLY as the confirmed design's Appendix B declared it:
// with ElementChain sub-chains. It declares fine and it type-checks fine, and
// it is nevertheless uncallable on its own object/string/number/boolean slots,
// because ElementChain resolves the sub-chain's subject to ElementOf<TValue>,
// which for a non-array is `never`. Every call comes back as
//   Property 'min' does not exist on type 'SlotTypeMismatch<"string", never>'.
//
// It is kept because a declaration-only fixture is what let that defect
// through the first time, and the plugin-kit type tests use it to show that a
// PluginDefinition can be perfectly well-formed and still be wrong at the call
// site. It lives HERE, and not under src/plugins/**, for two reasons: it is a
// probe rather than a shipping plugin, and it shares `name` and `method` with
// the real conditionalSchema, which the plugin catalog would reject as a
// duplicate. The shipping one is src/plugins/conditional-schema/.
// ===========================================================================
import { definePlugin } from "../../src/plugin-kit/plugin-definition";
import { branch, composite } from "../../src/plugin-kit/create-rule";
import { PASS } from "../../src/types";
import type { CheckOutcome, RuleContext } from "../../src/types";
import type {
  BranchRunner,
  CompositeBranch,
} from "../../src/plugin-kit/compiled-rule";
import type {
  ElementChain,
  Unchanged,
} from "../../src/plugin-kit/marker.types";

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

export const conditionalSchemaAsDesignedPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [
    condition: ElementChain,
    then?: ElementChain,
    otherwise?: ElementChain,
  ];
  out: Unchanged;
  context: { taken: "then" | "else" | "none" };
}>()({
  name: "conditionalSchemaAsDesigned",
  method: "conditionalSchemaAsDesigned",
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
