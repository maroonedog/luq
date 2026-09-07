// ===========================================================================
// L7  src/plugins/union-guard/union-guard.ts
// `b.union.guard(isCat, sub => ...)`: a type guard plus the rules that apply
// once it holds.
//
// The chain SYNTHESISES this method's signature from `out: GuardOut` (see
// src/chain/chain-method.types.ts), which is what makes `condition` a
// `value is X` predicate and `define` a chain over X. That is also what makes
// the union coverage check possible: each guard narrows the state by X, and a
// union with an uncovered member never reaches build().
//
// The composite carries ONE branch and the engine runs it. Legacy needed a
// whole third plugin mechanism (composable-conditional) for this, which
// docs/legacy-spec/plugin-contract.md records as the reason the mechanism
// existed at all; the branch/combine pair replaces the mechanism.
//
// `b.union` gets no injected type guard, so a value that satisfies no
// condition simply runs no branch — which is why the coverage check, not this
// plugin, is what makes a union exhaustive.
// ===========================================================================
import { PASS } from "../../types";
import type {
  CheckOutcome,
  MessageContextExtra,
  RuleContext,
} from "../../types";
import { branch, composite } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { BranchRunner } from "../../plugin-kit/compiled-rule";
import type {
  GuardOut,
  NarrowedChain,
  SelfGuard,
} from "../../plugin-kit/marker.types";
import type { SelfGuardFn } from "../../plugin-kit/runtime-args.types";

function runGuardedBranch(
  runners: readonly BranchRunner[],
  condition: SelfGuardFn
): (value: unknown, ctx: RuleContext) => CheckOutcome {
  const guarded = runners[0];
  return (value, ctx) => {
    if (guarded === undefined || !condition(value)) return PASS;
    return guarded.run(value, ctx);
  };
}

/**
 * WHICH argument positions carry a sub-chain cannot be recovered from a
 * plugin's type at run time — a NarrowedChain and a RootPredicate are both
 * plain functions once erased — so src/chain/collect-branch-rules.ts reads it
 * from this declared field. definePlugin's spec does not carry it yet (see
 * needsFromOthers), which is why it is spread on rather than passed in.
 */
export const unionGuardPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [condition: SelfGuard, define: NarrowedChain];
  out: GuardOut;
  context: MessageContextExtra;
}>()({
  name: "unionGuard",
  method: "guard",
  slots: ["union"] as const,
  build: (ctx, condition, define) =>
    composite({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches: [branch("guard", define)],
      combine: (runners) => runGuardedBranch(runners, condition),
      describe: () => "Value does not satisfy the guarded branch",
      buildMessageContext: () => ({}),
    }),
  subChainArguments: [1],
});
