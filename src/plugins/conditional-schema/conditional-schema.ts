// ===========================================================================
// L7  src/plugins/conditional-schema/conditional-schema.ts
// Draft-07 if / then / else, as a THREE-BRANCH composite.
//
// Legacy semantics (docs/legacy-spec/plugin-catalog-relational.md#conditionalSchema):
// evaluate `if`; on success apply `then`, otherwise apply `else`; a missing
// arm passes. The `if` arm never reports — its only job is to choose.
//
// NOT carried over: legacy took three JSONSchema7 documents and evaluated them
// with a private `evaluateSchema` that understood `type`, and `const`/`enum` at
// two levels, and nothing else. The arms are sub-chains here, so they are the
// same rules, run by the same engine, as everything else in the schema; this
// file contains no schema evaluator at all.
//
// REPAIR (the defect a declaration-only fixture could not catch): if/then/else
// constrains the SAME instance, not its elements, so the sub-chains are
// NarrowedChain — a chain over Present<TValue, TState>. Declared as
// ElementChain, as the design appendix had it, every call on a non-array slot
// fails with SlotTypeMismatch<"string", never>. See
// test/support/conditional-schema-as-designed.ts, which keeps that version
// alive so the difference stays visible.
// ===========================================================================
import { definePlugin } from "../../plugin-kit/plugin-definition";
import { branch, composite } from "../../plugin-kit/create-rule";
import { PASS, fail } from "../../types";
import type { CheckOutcome, RuleContext } from "../../types";
import type {
  BranchRunner,
  CompositeBranch,
} from "../../plugin-kit/compiled-rule";
import type { NarrowedChain, Unchanged } from "../../plugin-kit/marker.types";

export type ConditionalArm = "then" | "else" | "none";

export interface ConditionalSchemaContext {
  readonly taken: ConditionalArm;
}

function readArm(branchLabel: string | undefined): ConditionalArm {
  if (branchLabel === "then") return "then";
  if (branchLabel === "else") return "else";
  return "none";
}

/**
 * The arm's own failure detail is kept and re-labelled with the arm, so a
 * message factory can say WHICH arm rejected the value without the runtime
 * having to know that if/then/else exists.
 */
function routeConditional(
  runners: readonly BranchRunner[],
  thenIndex: number,
  elseIndex: number
): (value: unknown, ctx: RuleContext) => CheckOutcome {
  const condition = runners[0];
  return (value, ctx) => {
    if (condition === undefined) return PASS;
    const matched = condition.run(value, ctx).ok;
    const taken = matched ? thenIndex : elseIndex;
    if (taken < 0) return PASS;
    const runner = runners[taken];
    if (runner === undefined) return PASS;
    const outcome = runner.run(value, ctx);
    return outcome.ok
      ? PASS
      : fail({ ...outcome.detail, branch: matched ? "then" : "else" });
  };
}

/**
 * WHICH argument positions carry a sub-chain cannot be recovered from a
 * plugin's type at run time — a NarrowedChain and a RootPredicate are both
 * plain functions once erased — so src/chain/collect-branch-rules.ts reads it
 * from this declared field. definePlugin's spec does not carry it yet (see
 * needsFromOthers), which is why it is spread on rather than passed in.
 */
export const conditionalSchemaPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [
    condition: NarrowedChain,
    then?: NarrowedChain,
    otherwise?: NarrowedChain,
  ];
  out: Unchanged;
  context: ConditionalSchemaContext;
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
    return composite<ConditionalSchemaContext>({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches,
      combine: (runners) => routeConditional(runners, thenIndex, elseIndex),
      describe: (detail) =>
        `Value must match the "${readArm(detail.branch)}" schema`,
      buildMessageContext: (detail) => ({ taken: readArm(detail.branch) }),
    });
  },
  subChainArguments: [0, 1, 2],
});
